+++
date = '2026-09-27'
title = 'How to Run Local LLMs on Arch Linux With an RTX 3050 and 64GB RAM'
description = 'Configure an Arch Linux PC with an RTX 3050 4GB, and 64GB RAM to run local AI models with llama-server: tuned presets for nine models including gpt-oss-20b, the built-in browser chat UI, and OpenCode as a local coding assistant.'
tags = ['Tech', 'Linux', 'AI', 'LLM', 'Nvidia']
draft = false
+++
Running AI models locally means your prompts never leave your machine, you don't pay per token, and you learn how the technology actually works. This article covers the setup I use on Arch Linux with an NVIDIA GeForce RTX 3050 (4GB VRAM), a Radeon integrated GPU, and 64GB of system RAM.

To set expectations up front: this rig is not a local GPT-killer. What it *is* is a genuinely capable private assistant — a snappy small model for everyday chat, a decent coding model for agentic work in OpenCode, and enough RAM to run surprisingly large models when you don't mind waiting a few extra seconds.

By the end you'll have a single `llama-server` process serving an OpenAI-compatible API on localhost, managed by systemd, that only consumes resources when a model is actually requested. You'll have a browser chat UI at `http://localhost:8080` for trying models and watching their reasoning, plus the OpenCode configuration to use the same server as a local coding assistant (this article targets **OpenCode V2, currently in beta**).

## How much context can this rig handle?

A local model's memory is two separate budgets: **weights** (fixed at load time) and the **KV cache** — what the model remembers of the conversation, which grows linearly with context length and must be re-read on *every token generated*. On a 4GB card with 64GB of RAM, RAM is effectively unlimited and VRAM is the squeeze point. Here's what the models in this guide actually report in their GGUF headers:

| Model | Trained context | KV per token (q8_0) | Configured here | Why stopped there |
|---|---|---|---|---|
| Qwen3-Coder-30B-A3B | 262k | ~48KB | **64k** | cheapest KV of the set; 64k of cache ≈ 3.1GB of RAM |
| Gemma 4 26B A4B IT | 262k | ≤30KB (sliding-window) | **64k** | only ~7 of its 30 layers keep a full cache |
| gpt-oss-20b | 131k | **25.5 KiB** | **32k** | 0.80GB of KV — verified from the header; 11.3GB of weights can never live on a 4GB card, so this model is RAM-bound and extra context only costs speed |
| Qwen2.5-Coder-7B | 131k | **29.8 KiB** | **32k** | 0.93GB of KV at 32k, and it's the fastest tool-calling coder in the set |
| Magistral-Small-2509 | 131k | ~80KB | **32k** | dense 32B weights are already CPU-bound; don't pile on |
| Qwen3 8B Instruct | 40k | ~72KB | **32k** | 32k stays inside its trained window |
| Qwen3 4B Instruct | 32k | ~72KB | 16k | at 32k its KV (~2.4GB) busts VRAM and it loses full-GPU speed |
| Phi-4-mini-reasoning | 131k* | ~64KB | 16k | same story — small and fast beats big and spilled |
| Qwen2.5-Coder-1.5B | 32k | **14.9 KiB** | 32k | 0.46GB; the fill-in-the-middle model, never loaded for chat |

You don't have to trust the table's arithmetic — every KV figure above is
computed straight from the GGUF header rather than estimated:

```bash
llama-gguf ~/models/gpt-oss-20b-MXFP4.gguf r n | grep -E "block_count|head_count_kv|key_length|sliding_window"
```

The formula is just `layers x 2 (keys and values) x kv_heads x head_dim x bytes-per-element`. For gpt-oss-20b that's `24 x 2 x 8 x 64 x 1.0625` (a `q8_0` block stores 32 int8 values plus an fp16 scale, so 1.0625 bytes per element) — 25.5 KiB per token, or 0.80GB at 32k. Run `llama-gguf <file> r n` yourself and check the arithmetic against any model you add.

How to read this table:

- **Trained context** is the quality horizon. Within it, longer is simply "remembers more"; past it the model degrades (llama.cpp will auto-scale RoPE to cope, but don't count on coherent recall beyond the trained window). *(Phi-4-mini's 131k is YaRN-expanded from a 4k base — long-range quality there is its own story.)*
- **KV per token × context length = cache size.** The q8_0 quantized KV caches (configured later) halve these numbers versus the f16 default — at a quality cost so small it's free on this hardware.
- **The benefit of more context:** OpenCode can read more files, keep more history, and compact less often — fewer "exceeds the available context size" errors and better long-task coherence.
- **The trade-off is speed at depth, not crashes.** Attention re-reads the whole cache per token, so a session at 60k decodes noticeably slower than one at 5k — but only when you're actually deep. Shallow sessions cost nothing extra. And with 64GB of RAM, an over-ambitious context spills to memory instead of killing anything; llama.cpp's `--fit` just quietly moves work off the GPU.
- **The small-model trap:** the 4B and Phi models earn their "Full GPU" label by fitting weights + KV on-card at 16k. Raise them and the KV alone pushes the cache to CPU — a bigger window on paper, slower in practice. Leave them alone.

The configs later in this article set exactly these ceilings per model, and OpenCode's per-model budgets sit ~10% below them.

## Understanding AI and LLMs

Before choosing models, it helps to know what you're choosing between. Here are the terms I'll use through the rest of the article:

- **LLM (Large Language Model)** — a neural network trained to predict the next token (piece of text) in a sequence. It has no database lookup; everything it "knows" comes from the weights.
- **Parameters** — the adjustable weights in the network. A 4B model has ~4 billion of them. More parameters generally means smarter, but also slower and more memory-hungry.
- **Tokens** — how text is chunked for the model. Roughly 4 characters per token in English. The model sees a sliding window of the previous tokens, called the **context window**.
- **Inference** — generating text. It happens in two phases: **prefill** (processing your prompt, fast and batchy) and **decode** (producing tokens one at a time — this is what you feel as "speed").
- **Quantization** — compressing weights from full precision (FP16) into integer formats to shrink memory and speed things up, at a small quality cost.
- **GGUF** — the file format llama.cpp uses for quantized models.
- **Dense vs MoE** — dense models use all parameters for every token. Mixture-of-Experts models route each token through only a fraction of their experts, giving big-model capability at a fraction of the per-token cost. This matters a lot on your 64GB RAM.
- **VRAM offload** — the trick of running some model layers on the GPU and the rest in system RAM, trading VRAM pressure for speed. This is the heart of this setup.

## Choosing and Understanding Model Versions

### Base vs Instruct
Never run a *base* model for chat or coding. Base models just complete text; the versions you want are the **Instruct/Chat** variants — fine-tuned to follow instructions and trained with a chat template. If a model name ends in `-Instruct`, `-Chat`, or `-it`, that's the one you want.

### Quantization levels
GGUF files come in multiple quants. Smaller quants = less memory, faster, but measurably dumber:

| Quant | Approx. size of 8B model | When to use |
|---|---|---|
| Q8_0 | ~8.5GB | Near-lossless; only if you have RAM to spare |
| Q5_K_M | ~5.5GB | Quality-first, fits in RAM comfortably |
| **Q4_K_M** | **~4.7GB** | **The default sweet spot — start here** |
| Q3_K / Q4_0 | ~3.5–4GB | Only when squeezing into limited VRAM; visibly worse |
| **MXFP4** | **~5.6GB** | **Only for gpt-oss — see below** |

**MXFP4 is a different species, not a smaller Q4_K_M.** Most GGUFs quantize
16-bit weights down to ~4.5 effective bits with block-wise scales. MXFP4 is a
hardware-style format using shared 32-element exponent scales, and gpt-oss-20b
was *trained* with it rather than quantized after the fact — the upstream
weights are natively MXFP4, which is why the official release ships only in that
format. Practically: expect it to be slightly *better* than a same-size Q4_K_M
because it isn't a post-hoc conversion, and don't go looking for a Q4_K_M of
gpt-oss that matches it. The trade-off is tooling: MXFP4 is newer, and older
llama.cpp builds won't load it at all. Check your build supports it before
downloading 11GB.

### Reading model names
`Qwen3-8B-Instruct-Q4_K_M-GGUF` decodes as: family `Qwen3`, size `8B`, tuning `Instruct`, quant `Q4_K_M`, format `GGUF`. Everything you need to know is in the name.

One warning before you trust it: **the name describes the training run, not the file you download.** `gpt-oss-20b` is an 11.3GB MXFP4 file, not 20GB of 4-bit weights, because 4 of its 32 experts are active per token. `Qwen3-30B-A3B` tells you the active count in the name for the same reason. The parameter count in a name is a quality signal, never a disk-usage estimate — check the actual file.

### Dense vs MoE — your secret weapon
With 64GB of RAM, the densest models you can reasonably run are 14–32B at Q4. But there's a smarter option: **MoE models**. `Qwen3-30B-A3B` has 30B total parameters but only ~3B *active* per token — so it gives big-model quality at roughly a 3B model's per-token compute cost. It's slower to load from disk, but CPU inference throughput is surprisingly good. If you want to dip into "smart model" territory on this hardware, this is the way.

### Thinking vs non-thinking variants
Many recent models have **thinking (reasoning)** variants that emit chain-of-thought before answering. They're slower but much better at math, logic, and tricky debugging. `llama-server` handles the thinking tokens in its responses, and OpenCode can display them via a `reasoningField` setting we'll cover later. For everyday chat, use the non-thinking variants; for hard problems, switch.

gpt-oss takes this further and makes the effort level a **dial** rather than a
separate model. Its Harmony chat template accepts a `reasoning_effort` setting of
`low`, `medium`, or `high`, defaulting to `medium`:

```ini
; server-side preset, not a per-request parameter — restart to change it
chat-template-kwargs = {"builtin_tools": [], "reasoning_effort": "low"}
```

That's a meaningfully different lever from picking a `-Reasoning` model, because
it's tunable without downloading a second set of weights. It's also the *only*
one that helps when your bottleneck is RAM bandwidth rather than model size —
see the gpt-oss section above.

### Context length trade-offs
The KV cache (remembered context) grows with the context window — a 32k window can cost several GB on top of the model. Even with 64GB RAM, start at 8k context and raise it deliberately. More context also means slower decode.

### Tool calling
For agentic use (like OpenCode calling tools: reading files, running commands), the model must support **function calling**. Qwen3 and Qwen2.5-Coder do this well; verify tool support on the model card before relying on it.

## Best Models for This Hardware

Tiered recommendations with rough Q4_K_M sizes:

| Tier | Model | Size (Q4) | Runs on | Best for |
|---|---|---|---|---|
| GPU-native (fast) | Qwen3 4B | ~2.5GB | Full GPU | Snappy daily chat |
| GPU-native | Gemma 3 4B | ~2.5GB | Full GPU | Balanced instruction following |
| GPU-native | Phi-4-mini (3.8B) | ~2.4GB | Full GPU | Math/reasoning at speed |
| Hybrid sweet spot | Qwen3 8B | ~5GB | Split GPU/CPU | Best all-rounder on this box |
| Hybrid | Llama 3.1 8B / Mistral 7B | ~4.5–5GB | Split GPU/CPU | General assistant with a big ecosystem |
| Coding (recommended for OpenCode) | Qwen2.5-Coder 7–8B / Qwen3-Coder | ~5GB | Split GPU/CPU | Code plus tool calling for agents |
| RAM-heavy quality | Qwen3 14B | ~9GB | Mostly CPU | Smarter answers when you can wait |
| RAM-heavy MoE | Qwen3-30B-A3B | ~16GB | Mostly CPU | Big-model quality, surprisingly fast on CPU |
| RAM-heavy MoE (open-weights reasoning) | gpt-oss-20b | ~11GB | Mostly CPU | Best answers in the set; tune `reasoning_effort` or it spends its time thinking |
| Reasoning | DeepSeek-R1 / QwQ distills 7–14B | 4.5–9GB | Split/CPU | Chain-of-thought problem solving |
| Embeddings (for RAG) | nomic-embed-text | ~0.3GB | CPU/GPU | Local search over your own documents |

**Which one should you pick?** Fastest experience → the 4B GPU models. **Best for coding with OpenCode → the 8B coder (Qwen2.5-Coder / Qwen3-Coder) with a layer split** — tool calling and multi-step agent loops are where small models fall apart, and the 8B coder family is the reliable sweet spot on this hardware, delivering ~20–35 tok/s while keeping VRAM headroom. Best quality you can afford → Qwen3-30B-A3B or gpt-oss-20b, both great for hard reasoning and refactors but noticeably slower in interactive agent loops. The OpenCode config near the end of this article defaults to the 30B coder for quality — point `model` at `local/qwen3-8b` instead when you want the snappier daily loop.

### A practical nine-model lineup

The configuration examples further down wire up a curated set — eight instruct
models exposed to OpenCode, plus one fill-in-the-middle model served for
autocomplete only. All are tool-calling chat models with real weights on this
machine, ranging from instant GPU-native chat to slow-but-smart MoE quality:

| Model | Quant | Size | Where it runs | What it's good for |
|---|---|---|---|---|
| Qwen3-Coder-30B-A3B-Instruct | Q4_K_M | 17.3GB | Split / mostly CPU (MoE) | **Best agentic coding on this box** — refactors, architecture, long agent loops; only 3B active params, so it stays usable |
| Qwen3 8B Instruct | Q4_K_M | 4.7GB | Split GPU/CPU | Best all-rounder; reliable tool calling and the sweet spot for everyday OpenCode sessions |
| Gemma 4 26B A4B IT | Q4_K_M | 15.6GB | Split / mostly CPU (MoE) | General assistant with long context; multimodal too if you also grab its `mmproj` file |
| gpt-oss-20b | MXFP4 | 11.3GB | Mostly CPU (MoE) | OpenAI's open-weights reasoning model; the best *chat* answer in the set, and 4 of 32 experts active keeps it lively |
| Magistral-Small-2509 | Q4_K_M | 13.4GB | Split / mostly CPU | Mistral thinking model — planning, analysis, tricky reasoning, careful answers |
| Phi-4-mini-reasoning | Q4_K_M | 2.3GB | Full GPU | Snappy math/logic reasoning; small enough to live entirely in VRAM |
| Qwen3 4B Instruct | Q4_K_M | 2.3GB | Full GPU | Tiny/fast chat and simple tool use; loads instantly |
| Qwen2.5-Coder-7B-Instruct | Q4_K_M | 4.4GB | Split GPU/CPU | Fast, well-behaved tool calling — the quickest coder in the set |
| Qwen2.5-Coder-1.5B | Q4_K_M | 0.9GB | Mostly CPU | **Not for chat.** FIM/autocomplete model, served on its own for `POST /infill` |

A good split of duties: the 4B and Phi models answer quick questions at full
speed, Qwen3 8B and the 7B coder handle daily agent work, and the 30B Coder
(or the other big MoE/dense models) comes in when you can wait a little longer
for quality. All eight chat models speak the OpenAI-compatible API with tool
calling — that's what makes them drop-in models for OpenCode.

> [!NOTE]
> **Sizes are measured, not estimated.** `stat -c %s` (or `ls -lh`) on the real
> `.gguf` files is the honest number, and it is often kinder than the model card
> claims — gpt-oss-20b is an 11.3GB file despite the "20B" in its name, because
> MXFP4 stores roughly 4 bits per weight plus per-block scales. Don't pick a
> model on the parameter count in its name; check the file.

### Why gpt-oss-20b earns its place

`gpt-oss-20b` is the one model here that isn't a Qwen derivative, and it's
worth understanding before you point a client at it. Reading its GGUF header
directly:

```bash
llama-gguf ~/models/gpt-oss-20b-MXFP4.gguf r n | grep -E "gpt-oss\."
```

```text
gpt-oss.block_count                  = 24
gpt-oss.context_length               = 131072
gpt-oss.attention.head_count         = 64
gpt-oss.attention.head_count_kv      = 8
gpt-oss.attention.sliding_window     = 128
gpt-oss.expert_count                 = 32
gpt-oss.expert_used_count            = 4
gpt-oss.rope.scaling.type            = yarn
gpt-oss.rope.scaling.original_context_length = 4096
```

Four things follow from those numbers, and they drive every setting in the
config further down:

- **It's an MoE with 32 experts, 4 active.** That changes what "20B" costs you
  per token. Only the 4 chosen experts are read on each step, so the per-token
  weight traffic is roughly an eighth of the expert weights — call it 2GB
  streamed from RAM, not the full 11.3GB file — and the compute is closer to a
  4B model than a 20B one. The 11.3GB figure is how much has to be *resident*
  (and on disk), not what moves per token. The other half of the win: the
  attention and embedding weights are small enough that `--fit` can put them on
  the GPU, leaving the experts to stream.
- **The KV cache is unusually cheap — 25.5 KiB/token.** GQA with only 8 KV heads
  against 64 query heads is aggressive, and 32k context costs 0.80GB. You could
  afford 64k (1.59GB) in RAM, but see the speed note below before you do.
- **`sliding_window = 128`.** Three of every four layers only attend to the last
  128 tokens, so only 6 of the 24 layers carry a genuinely long-range cache.
  That's *why* the naive 0.80GB figure is conservative rather than alarming.
- **RoPE is YaRN-scaled from a 4096 base** (`scaling.factor = 32`), so its 131k
  is an expansion, not a native window. Long-context recall degrades gracefully
  rather than falling off a cliff, but it isn't Qwen3-Coder's native 262k.

> [!IMPORTANT]
> **gpt-oss-20b is CPU-bound on this rig, so it is a chat model, not your
> OpenCode default.** 11.3GB of weights cannot live on a 4GB card no matter what
> `--fit` does, so every token streams its active experts out of system RAM over
> DDR4. Expect interactive-but-not-brisk speeds. Keep `qwen3-coder-30b` or the
> 7B coder as your coding default and reach for gpt-oss when you want the best
> answer rather than the fastest one.


## Preparing the NVIDIA Driver Stack on Arch

Modern Arch uses **NVIDIA's open kernel modules** — that's the recommended path on Turing and newer GPUs (the RTX 3050 is Ampere), and since the 590 driver series even the plain `nvidia` package ships them. We'll install them explicitly:

```bash
sudo pacman -S nvidia-open nvidia-utils lib32-nvidia-utils
nvidia-smi
```

> [!NOTE]
> Variants: `nvidia-open-lts` if you run `linux-lts`, `nvidia-open-dkms` for custom kernels. The `cuda` toolkit package is only needed if you plan to build llama.cpp or other CUDA tooling yourself — `nvidia-utils` is what llama.cpp's CUDA backend actually talks to. If you do install `cuda`, make sure its version is compatible with your driver.

The `nvidia` packages ship a `nouveau` blacklist, so a reboot should leave you with the NVIDIA module loaded. Verify:

```bash
nvidia-smi
lsmod | grep nvidia
```

Hybrid graphics (this machine's Radeon iGPU + NVIDIA dGPU) doesn't complicate things for our purposes: llama.cpp uses the NVIDIA card directly through CUDA regardless of which GPU drives your display. `prime-run` is only relevant for GL/gaming apps.

> [!WARNING]
> If you see `CUDA driver version is insufficient`, your driver and any CUDA toolkit you installed disagree on versions — update the driver, then the toolkit.
>
> If you're on an **Ampere laptop** and hit crashes on suspend/resume or idle, that's a known GSP-firmware issue with the open modules. Fall back to the proprietary driver (`nvidia-580xx-dkms` from the AUR) with the module parameter `NVreg_EnableGpuFirmware=0`.

## Installing llama.cpp and llama-server

Install from the official repositories:

```bash
sudo pacman -S llama-cpp ggml-cuda
```

Arch now splits llama.cpp into a core package plus GPU backend plugins: `llama-cpp` ships the base binaries, and the `ggml-*` packages drop runtime backends into `/usr/lib/ggml/`. The one you want for the RTX 3050 is **`ggml-cuda`** (CUDA). If you ever want to experiment with the Radeon iGPU instead, `ggml-vulkan` is the optional alternate backend — but CUDA is the one that matters for this setup.

The binaries provided are `llama-server` (the HTTP API server), `llama-cli` (interactive chat), `llama-bench` (benchmarking), and `llama-quantize` (re-quantizing models). Verify the install and that the CUDA backend is picked up:

```bash
llama-server --version
llama-cli --list-devices
```

You should see the RTX 3050 listed under CUDA devices. (If you built from source or grabbed an AUR package instead, make sure it was compiled *with* CUDA — that's the single most common reason for the GPU being ignored later.)

## Downloading Your First Model

Grab a Q4_K_M GGUF from Hugging Face. Repos named after the model maker (`Qwen/Qwen3-4B-Instruct-GGUF`) are the safest source; quantizer accounts like `dnevinr`, `bartowski`, or `lmstudio-community` are fine too and often have better file coverage — they're the ones who actually produce the quants. Either way, read the repo's file list before assuming a filename; casing and naming vary (`qwen3-8b-q4_k_m.gguf` vs `Qwen3-8B-Q4_K_M.gguf` are the same file to you and a 404 to `hf download`).

The modern Hugging Face CLI is **`hf`** — older guides still cite the legacy name `huggingface-cli`. On Arch, install it and download:

```bash
sudo pacman -S python-huggingface-hub   # provides the hf CLI
hf download dnevinr/Qwen3-8B-Q4_K_M-GGUF \
  qwen3-8b-q4_k_m.gguf --local-dir ~/models
```

**Prefer no Python at all?** llama.cpp downloads models natively with `-hf` — no extra CLI needed:

```bash
llama-cli -hf dnevinr/Qwen3-8B-Q4_K_M-GGUF:Q4_K_M
# files land in ~/.cache/llama.cpp (or your LLAMA_CACHE dir)
```

That cache is where the server's router mode auto-discovers models from, so it ties into the on-demand setup in the **Running Automatically With systemd and On-Demand Model Loading** section below. The rest of this article keeps everything in `~/models` and points each preset at its file by path, which is simpler to reason about and gives you control over the model id. What's *not* allowed is a model that neither a preset nor the cache knows about; the router has no third discovery route.

Sanity-check the file before running a server:

```bash
llama-cli -m ~/models/qwen3-8b-q4_k_m.gguf -p "Hello!"
```

### Downloading the whole lineup

One command per model, all landing in `~/models`, matching the `config.ini` later in the article exactly. Copy the block, or run them one at a time as you need them:

```bash
mkdir -p ~/models

# --- the big three: quality picks, RAM-heavy, download overnight -------------
hf download n00b001/Qwen3-Coder-30B-A3B-Instruct-Q4_K_M-GGUF \
  qwen3-coder-30b-a3b-instruct-q4_k_m.gguf      --local-dir ~/models   # 17.3GB
hf download lmstudio-community/gemma-4-26B-A4B-it-GGUF \
  gemma-4-26B-A4B-it-Q4_K_M.gguf                --local-dir ~/models   # 15.6GB
hf download lmstudio-community/gpt-oss-20b-GGUF \
  gpt-oss-20b-MXFP4.gguf                        --local-dir ~/models   # 11.3GB

# --- thinking model ---------------------------------------------------------
hf download lmstudio-community/Magistral-Small-2509-GGUF \
  Magistral-Small-2509-Q4_K_M.gguf              --local-dir ~/models   # 13.3GB

# --- the everyday workhorses ------------------------------------------------
hf download dnevinr/Qwen3-8B-Q4_K_M-GGUF \
  qwen3-8b-q4_k_m.gguf                          --local-dir ~/models   #  4.7GB
hf download Qwen/Qwen2.5-Coder-7B-Instruct-GGUF \
  qwen2.5-coder-7b-instruct-q4_k_m.gguf        --local-dir ~/models   #  4.4GB
hf download lmstudio-community/Qwen3-4B-GGUF \
  Qwen3-4B-Q4_K_M.gguf                          --local-dir ~/models   #  2.3GB
hf download lmstudio-community/Phi-4-mini-reasoning-GGUF \
  Phi-4-mini-reasoning-Q4_K_M.gguf              --local-dir ~/models   #  2.3GB

# --- fill-in-the-middle model for POST /infill -------------------------------
hf download neopolita/qwen2.5-coder-1.5b-gguf \
  qwen2.5-coder-1.5b_q4_k_m.gguf                --local-dir ~/models   #  0.9GB
```

That's **~72GB** in total, so you almost certainly don't want all of it on day one. Start with `qwen3-8b` (4.7GB) to prove the pipeline works, then add what you actually use.

> [!NOTE]
> Every model below is **Q4_K_M** except two, both deliberately:
>
> - **`gpt-oss-20b` is MXFP4.** OpenAI ships the 20B weights in that format and
>   nowhere else, so there is no Q4_K_M to switch to.
> - **`qwen3-coder-30b-a3b-instruct` is Q4_K_M** (17.3GB). The same uploader also
>   publishes a **Q4_0** build at 16.1GB — 1.2GB smaller and lower quality. Both
>   quantize 4-bit weights, but `Q4_0` gives all 32 weights in a block a single
>   FP16 scale, so one outlier compresses the other 31 badly; `Q4_K_M` tracks a
>   min and scale per sub-block and wastes far less range. Take the Q4_K_M; take
>   the Q4_0 only if you're counting bytes.
>
> ```bash
> # the smaller, lower-quality alternative to the 30B coder above
> hf download n00b001/Qwen3-Coder-30B-A3B-Instruct-Q4_0-GGUF \
>   qwen3-coder-30b-a3b-instruct-q4_0.gguf --local-dir ~/models
> ```

> [!NOTE]
> Three things that will save you a wasted 16GB download:
>
> - **`Qwen/Qwen2.5-Coder-7B-Instruct-GGUF` ships two forms of the same quant** — a
>   single `qwen2.5-coder-7b-instruct-q4_k_m.gguf` (4.36GB) and a sharded
>   `-00001-of-00002` + `-00002-of-00002` pair totalling the same 4.36GB. Grab the
>   single file as above. If you ever *do* get shards, all parts must sit in the
>   same directory and you load the `-00001-` one; llama.cpp won't stitch them
>   for you.
> - **Add `--include` when you want several quants from one repo.** Naming files
>   explicitly, as above, is safer than `hf download <repo>` with no arguments —
>   that pulls *every* quant in the repo and can be 100GB+ on your largest models.
> - **Two models have a second file for vision.** `gemma-4-26B-A4B-it-GGUF` and
>   `Magistral-Small-2509-GGUF` each publish an `mmproj-*.gguf` projector
>   (1.1GB and 0.8GB). Skip them unless you want image input; `llama-server`
>   only uses one if you pass it explicitly.
>
> ```bash
> # multimodal projectors, only if you need image input
> hf download lmstudio-community/gemma-4-26B-A4B-it-GGUF \
>   mmproj-gemma-4-26B-A4B-it-BF16.gguf --local-dir ~/models
> hf download lmstudio-community/Magistral-Small-2509-GGUF \
>   mmproj-Magistral-Small-2509-F16.gguf --local-dir ~/models
> ```

> [!TIP]
> Models that aren't in the lineup table but appear in the tier
> recommendations download the same way — it's always
> `hf download <user>/<repo> <file>.gguf --local-dir ~/models`. Two useful
> examples while you're experimenting:
>
> ```bash
> hf download Qwen/Qwen3-14B-GGUF Qwen3-14B-Q4_K_M.gguf --local-dir ~/models
> hf download nomic-ai/nomic-embed-text-v1.5-GGUF \
>   nomic-embed-text-v1.5.Q8_0.gguf --local-dir ~/models   # for RAG
> ```
>
> Any preset pointing at a file that isn't downloaded will fail to load on first
> request, so add a section per extra model you want.

### How to evaluate a model release online before downloading

Every GGUF release is really a small *release page*: the **model card** (the README), the **Files** list, and the **git history** behind it. Reading all three takes about five minutes and tells you what you're getting — version, quantizer, required llama.cpp, known issues — *before* you spend bandwidth. Walk them in order:

**Step 1 — Read the model card (the release notes).** The card is where uploaders document the release. Scan for:

- **The quant table** — usually a list like `Q8_0 (8.5GB)`, `Q5_K_M (5.5GB)`, `Q4_K_M (4.7GB)` with a recommended default. Use it to pick your quant (Q4_K_M for this rig).
- **Compatibility requirements** — lines like *"requires llama.cpp >= bXXXX"* or *"quantized with ggml commit …"*. Compare with your `llama-server --version`. This single line decides whether the file will even load on your build.
- **Update and deprecation notices** — *"re-uploaded to fix X"*, *"this repo supersedes …"*, *"no functional change since v1"*. This is the release changelog, effectively.
- **License and use-permissions box** — pick a model whose license you're OK with (important if you're using it in OpenCode for work).
- **Architecture notes** — context length, tool-calling support, MoE active-parameter counts. Useful sanity checks for your chosen use case.

**Step 2 — Inspect the Files tab (the release manifest).** Every file listed shows its size and last-modified date. What to look for:

- Does the quant you want exist, and what does its size actually say? (e.g. a "Q4_K_M" at an unexpected size suggests a different quantizer or a re-release.)
- Is the file fresh (recently modified) or months old? A file re-uploaded under the same name — same quant, different date and size — is a re-release of that name, and means your local copy of that "same" file may no longer match what the repo serves today.

**Step 3 — Read the release history (per-file commits).** Hugging Face repos are git repositories, so every file has its own commit trail. On the web: **Files** tab → click the file → **History**. From the terminal:

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://huggingface.co/dnevinr/Qwen3-8B-Q4_K_M-GGUF /tmp/gguf-check
cd /tmp/gguf-check
git log --oneline -n 10 -- qwen3-8b-q4_k_m.gguf
```

Interpret the commit messages — on GGUF repos they're usually descriptive:

| Commit message says | Meaning |
|---|---|
| "re-quantized with llama.cpp bXXXX" | New quantizer/GGUF version — check compatibility (Step 4) |
| "fixed tokenizer/vocab" | Correctness fix, worth taking |
| "corrected rope scaling / alignment" | Bug fix in the weights themselves, worth taking |
| "update to `<model>` v2 / new instruct release" | New upstream weights, genuinely newer model |
| "no functional change / repack" | Same content — skip unless you need the exact hash |

**Step 4 — Cross-check against llama.cpp.** Two directions of breakage to watch for:

- **Old file on new llama.cpp** — GGUF spec bumps (k-quants, the Q8_0 tokenizer change, i-quants) mean old files can warn or misbehave on current builds. The fix is re-downloading, and llama.cpp will tell you loudly at load time.
- **New file on old llama.cpp** — the file may fail to load entirely. If the card says *"requires llama.cpp >= bXXXX"* and yours is older, either upgrade llama.cpp or pick an older quantization of the model.

llama.cpp's own release notes (GitHub releases) mention GGUF format and quantizer changes per release, so they're the definitive reference for "is this format new?"

**Step 5 — Decide.**

| What you found | Verdict |
|---|---|
| New upstream weights (new instruct release) | **Download** — genuinely newer model |
| Tokenizer/vocab fixes, or a file your llama.cpp will warn about | **Download** — correctness/compatibility |
| Longer native context length than your current file | **Maybe** — only if you need the context |
| Re-quantized with a newer quantizer, same quant and size | **Marginal** — skip unless chasing quality |
| "No functional change" / identical metadata, new hash | **Skip** — repackaging noise |

**After downloading — verify locally.** Check the checksum against the Files tab, and let the load log confirm what the file actually is (the Arch `llama-cpp` package doesn't ship a metadata tool, but `llama-cli -v` dumps the same facts):

```bash
sha256sum ~/models/qwen3-8b-q4_k_m.gguf   # compare to the HF "files" tab
llama-cli -v -m ~/models/qwen3-8b-q4_k_m.gguf -p "hi" -n 1 </dev/null 2>&1 \
  | grep -aE "print_info: (file type|n_ctx_train|arch)"
```

The dump confirms the real quant (`file type = Q4_K - Medium`), the native context (`n_ctx_train`), and the architecture — three quick checks that the file is what the release page claimed.

If you decide a newer file *is* worth it but want to keep a known-good copy available, pin the old revision:

```bash
hf download dnevinr/Qwen3-8B-Q4_K_M-GGUF \
  qwen3-8b-q4_k_m.gguf --revision <commit-sha> --local-dir ~/models
```

## Running llama-server With GPU Offload

The core command:

```bash
llama-server -m ~/models/qwen3-8b-q4_k_m.gguf \
  --host 127.0.0.1 --port 8080 \
  -ngl 30 -c 8192 -t $(nproc) \
  --jinja --alias qwen3-8b
```

What each flag does:

- `-ngl 30` — offload 30 of the model's ~36 layers to the GPU; the rest run from RAM.
- `-c 8192` — 8k context window; the KV cache grows from here, so don't max it out blindly. Plenty for casual chat — but tool-heavy clients like OpenCode need a larger window (their fixed overhead alone can exceed 8k), which is why the router presets later size this per model.
- `-t $(nproc)` — use all CPU threads for the layers living in RAM.
- `--jinja` — force the Jinja chat template engine. **Note this is now the default**
  (`--jinja, --no-jinja ... default: enabled`), so on llama.cpp 0.4.x you can omit it;
  the running service below does, and tool calling works fine. It's still worth
  knowing if you pin an older build or override `--chat-template`, since without
  the Jinja engine only the short list of built-in templates is available.
- `--alias qwen3-8b` — the name clients use to select this model.
- `--reasoning-format` — worth adding later if you run thinking/reasoning models. Its
  default is `auto`, and the `deepseek` mode is what populates
  `message.reasoning_content` — the field OpenCode's `reasoningField` setting reads.

> [!NOTE]
> Port **8080** is llama-server's default. Don't confuse it with **11434**, which is Ollama's — the most common port mix-up in local LLM land. If a tool or tutorial talks about 11434, it's assuming Ollama, not llama.cpp.

> [!IMPORTANT]
> **Leave ~0.5GB of VRAM headroom** when choosing `-ngl`. The KV cache grows as context fills, and if the GPU runs out mid-session llama.cpp falls back or errors. Watch it live: run a prompt, then check `nvidia-smi` while it generates. The server startup log also tells you how many layers ended up on GPU vs CPU.
>
> With 4GB VRAM that means: ~2.5GB models (4B class) can run fully on GPU; ~5GB models (8B class) split at about 25–30 layers. For 14B+ models, lower `-ngl` to 10–20 and accept CPU-ish speeds — with 64GB of RAM, RAM is your comfort zone, not VRAM.

Test the OpenAI-compatible API:

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3-8b","messages":[{"role":"user","content":"Say hello in 5 words"}]}'
```

> [!NOTE]
> Why llama-server and not Ollama or LM Studio? Both are fine tools, but llama-server gives you direct control over every flag (`-ngl`, context, threads), it's one process with no extra daemon, and its API is OpenAI-compatible — which is exactly what OpenCode expects. Ollama-style model management (load on demand, unload when idle) now exists natively in llama-server too; see the next section.

## Running Automatically With systemd and On-Demand Model Loading

The problem with a static `llama-server` is it holds the model in memory permanently — several GB of RAM and VRAM consumed even when you're not using it. Newer llama.cpp has **router mode**: start the server *without* a model, let it learn what you have, and it loads a model the first time it's requested, then unloads via LRU eviction when you hit a configurable maximum.

```bash
llama-server --host 127.0.0.1 --port 8080 \
  --models-preset ~/.config/llama.cpp/config.ini --models-max 2
```

There are exactly two ways a model becomes known to the router, and it's worth knowing which you're using because it determines the id your clients must send:

| Mechanism | How it works | Resulting model id |
|---|---|---|
| **Presets file** | You name the `.gguf` path in a section | Whatever you name the section |
| **HF cache scan** | llama.cpp scans `~/.cache/llama.cpp` (or `$LLAMA_CACHE`) | The repo path plus quant, e.g. `lmstudio-community/gpt-oss-20b-GGUF:MXFP4` |

This article uses the first, because it gives you short, readable, stable ids. The second is what you get for free from `llama-cli -hf` or a `huggingface-cli download` that populates the cache without `--local-dir`, and it's why an id like `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M` can show up — the router is reporting the repo it came from, not anything you chose. `--models-dir ~/models` is a third convenience that adds one directory to the search, but you don't need it once every preset names a path, and pointing at files explicitly avoids registering the same GGUF twice under two different ids.

- **On-demand loading**: the first request naming a model pays the load time; subsequent requests are instant.
- **LRU eviction**: with `--models-max 2`, when a third model is requested the least-recently-used one unloads. Set this low (1–2) so RAM/VRAM stays mostly free.
- **Explicit control**: `--no-models-autoload` *rejects* requests for models that aren't loaded yet (`model is not loaded`) instead of loading them — you'd have to `POST /models/load` yourself first. Leave it off for OpenCode, whose flow depends on first-request loading; `POST /models/unload` is still handy for freeing a model deliberately.
- **Per-model settings** via a presets file, e.g. `~/.config/llama.cpp/config.ini`:

```ini
; ~/.config/llama.cpp/config.ini
; Section name = the model id exposed via /v1/models (used as OpenCode modelID)
; Keys = llama-server CLI args without leading dashes ("c" = --ctx-size)
version = 1

; Global defaults inherited by every model (per-section keys override)
[*]
c = 16384          ; context ceiling for any model without its own value
np = 2             ; slots per model (keep kv-unified ON — see the note below)
kv-unified = true
ctk = q8_0         ; 8-bit KV cache: halves context memory
ctv = q8_0         ; (this is what lets 16–64k contexts live on a 4GB card)

; ---------------------------------------------------------------------------
; The curated set. No n-gpu-layers is ACTIVE anywhere — deliberately. The
; default `-ngl auto` + `--fit` offloads as many layers per model as your VRAM
; honestly allows, and that is the config that passed every OpenCode test on
; this machine. Setting a value by hand OVERRIDES the auto-sizing: pick one too
; high and the model OOMs or `--fit` steals context to compensate. Uncomment a
; line only when the load log or `llama-bench` shows auto making a bad call for
; that model. The numbers below are measured examples of what auto chose here.
; ---------------------------------------------------------------------------

; Every model lives in one flat directory, and every section names its file
; explicitly. That is deliberate: pointing at the file (rather than letting the
; router scan for it) is what gives each model a short, stable id you control.
; `~/models` is the convention throughout this article.
[qwen3-coder-30b]
model = ~/models/qwen3-coder-30b-a3b-instruct-q4_k_m.gguf
c = 65536            ; trained for 262k, cheapest KV -> the long-window workhorse
; n-gpu-layers = 16  ; MoE: attention layers are the win, experts stay in RAM

[qwen3-8b]
model = ~/models/qwen3-8b-q4_k_m.gguf
c = 32768            ; this file's trained context is 40960 — stay inside it
reasoning = off      ; thinking traces break OpenCode's compaction template
; n-gpu-layers = 16

[gemma-4-26b]
model = ~/models/gemma-4-26B-A4B-it-Q4_K_M.gguf
c = 65536            ; sliding-window attention keeps most layers' cache tiny
; n-gpu-layers = 12

[magistral-small]
model = ~/models/Magistral-Small-2509-Q4_K_M.gguf
c = 32768            ; dense 32B is already CPU-bound; don't pile KV on top
; n-gpu-layers = 8   ; the GPU only earns the first few layers anyway

[phi-4-mini]
model = ~/models/Phi-4-mini-reasoning-Q4_K_M.gguf
; deliberately inherits c=16384: weights+KV fit 4GB here; 32k KV alone (~2.3GB) would push it out of the card
; n-gpu-layers = 99  ; ~2.3GB — everything fits on-GPU anyway

[qwen3-4b]
model = ~/models/Qwen3-4B-Q4_K_M.gguf
; same as phi: stay at 16k to keep it GPU-resident
; n-gpu-layers = 99

[qwen2.5-coder-7b]
model = ~/models/qwen2.5-coder-7b-instruct-q4_k_m.gguf
c = 32768            ; trained for 131k; KV is 29.8 KiB/token at q8_0, so 32k
                     ; costs 0.93GB — not the ~1.8GB an f16 estimate suggests
; n-gpu-layers = 16

; FIM / autocomplete model (llama-server only — deliberately NOT in OpenCode;
; serve completions via POST /infill).
[qwen2.5-coder-1.5b]
model = ~/models/qwen2.5-coder-1.5b_q4_k_m.gguf
c = 32768            ; equals its trained context; q8/np/unified inherited from [*]

; ---------------------------------------------------------------------------
; gpt-oss-20b (MXFP4, official weights) — chat + OpenCode. 24 layers, 8 KV
; heads, 128-token sliding window on 18 of them -> 25.5 KiB/token, 0.80GB of
; KV at 32k.
; ---------------------------------------------------------------------------
[gpt-oss-20b]
model = ~/models/gpt-oss-20b-MXFP4.gguf
c = 32768            ; trained for 131k; 64k would fit in RAM (1.59GB) but this
                     ; model is already RAM-bandwidth-bound, so more context
                     ; only buys slower decode
; The harmony template accepts chat-template kwargs, and BOTH of these matter:
;   "builtin_tools": []  -- the template otherwise advertises fake "browser"
;                           and "python" tools. A client that believes them gets
;                           tool calls to functions that do not exist.
;   "reasoning_effort"    -- defaults to "medium". On a CPU-bound 20B that
;                           means hundreds of analysis tokens per reply; "low"
;                           is the single biggest latency win available here.
chat-template-kwargs = {"builtin_tools": [], "reasoning_effort": "low"}
```

> [!NOTE]
> Four things learned the hard way on a 4GB card. **(1)** `-ngl` defaults to `auto` with `--fit` enabled, so the per-model `n-gpu-layers` lines above ship **commented out** — auto picks a better number than any single value you'd type, and it does so per model (a fixed `-ngl 30` on the CLI would be wrong for most of the lineup, and CLI args also *beat* preset keys, which is how `-ngl`/`-c` on the ExecStart line silently override everything in `config.ini`). Uncomment one only to override auto deliberately. **(2)** A full-precision KV cache at 16k context costs 2–5GB *on top of* the weights; `q8_0` halves that and is nearly free quality-wise. **(3)** If you set `np` explicitly, `--fit` can *silently shrink* `c` to make N private per-slot buffers fit (observed: `c=16384` loaded as `n_ctx_slot=8192`) — keep `kv-unified = true` so slots share one pool sized at `c`. Also: pass context/KV settings in `config.ini`, not the service unit. **(4)** `chat-template-kwargs` is a JSON object, and it **replaces** the template kwargs rather than merging with anything — so when you add `reasoning_effort` to gpt-oss, keep `builtin_tools: []` in the same object or the fake browser/python tools come straight back.

> [!TIP]
> **Tuning `reasoning_effort` is the cheapest speed knob you have.** gpt-oss's
> harmony template takes `low`, `medium`, or `high` and defaults to `medium`.
> Because the model is RAM-bound, the analysis channel dominates your
> time-to-first-token. `"low"` is right for interactive chat on this hardware;
> flip it to `"high"` temporarily when you're asking something genuinely hard
> and don't mind waiting. The setting lives in the server preset, so you need a
> `systemctl --user restart llama-server` to change it — it isn't a per-request
> parameter.

Check what's loaded with `curl http://127.0.0.1:8080/models` — each model reports `loaded`, `loading`, or `unloaded`.

Now wrap it in a systemd user service so it runs automatically:

```ini
# ~/.config/systemd/user/llama-server.service
[Unit]
Description=llama-server (local LLM API)
After=network-online.target

[Service]
ExecStart=/usr/bin/llama-server --host 127.0.0.1 --port 8080 \
  --models-preset %h/.config/llama.cpp/config.ini \
  --models-max 2 --sleep-idle-seconds 300
Restart=on-failure

[Install]
WantedBy=default.target
```

> [!NOTE]
> Notice what's **not** on that command line. There's no `--models-dir`, because
> every model is named by path in `config.ini` and the server has nothing left to
> discover — and skipping it deliberately avoids the router registering the same
> `.gguf` a second time under an auto-generated id. There's no `--jinja` either,
> because it's the default in 0.4.x. The command line is left almost empty on
> purpose: anything you put here **overrides** `config.ini`, which is how a stale
> `-ngl` or `-c` on `ExecStart` silently defeats the per-model presets. If a
> setting isn't in the preset file, it doesn't happen.

> [!NOTE]
> `%h` is a systemd **specifier** — shorthand that expands to the home directory of the user the service runs as, so `%h/models` becomes `/home/you/models`. Specifiers keep unit files portable across users and machines. A few handy ones: `%h` = home directory, `%u` = username, `%t` = your runtime directory (e.g. `/run/user/1000`), and `%%` = a literal `%`. The full list lives in `man systemd.unit` under *Specifiers*.

```bash
systemctl --user daemon-reload
systemctl --user enable --now llama-server
systemctl --user status llama-server
journalctl --user -u llama-server -f
```

> [!IMPORTANT]
> Enable **linger** so the service starts at boot without you logging in first: `loginctl enable-linger $USER`. Without it, the service starts on login — fine for a desktop machine.
>
> Bind to `127.0.0.1`, never `0.0.0.0`, unless you deliberately want your LAN to reach your models.

If you want models *unloaded after idle* even before `--models-max` pressure: the unit above already passes `--sleep-idle-seconds 300` (available in llama.cpp ≥ 0.4.x) — each loaded model sleeps and frees its memory after 5 minutes without traffic. On older builds, fall back to `--models-max 1` plus a small systemd timer that POSTs `/models/unload`.

## Chatting in the Browser at `http://localhost:8080`

The most immediate payoff, and the first thing you should try after the health check passes. llama-server ships a **built-in Web UI** — a single-page app served from the same port as the API, so there's nothing extra to install, no Electron app, no separate frontend to keep in sync with your server version.

```bash
# from another machine on the LAN (or a phone on the same wifi)
firefox http://192.168.1.50:8080
```

On this machine it's just `http://localhost:8080`.

That last point is worth pausing on. Every piece of client software you use for local LLMs — LM Studio, AnythingLLM, a browser extension, a chat frontend — is a *separate program* that can lag behind the server, ask for a port you didn't bind, or want a model management scheme of its own. The built-in UI is served by the server binary itself, so its API shape is guaranteed to match. When you change a preset, restart the service, and reload the page, there's no version skew to debug.

**What's in it.** The UI is a client of the same OpenAI-compatible endpoint
OpenCode uses, so anything you can do here you can automate later. Verified
against a running 0.4.x server:

- **A model picker listing every registered preset** — the same ids `/v1/models`
  reports, which here are the short names you chose in `config.ini`.
- **Streaming chat with live token output**, so you can watch generation instead
  of waiting on a blank screen. This is the single biggest UX difference from a
  plain `curl`.
- **Visible reasoning traces for thinking models.** gpt-oss-20b, Magistral, and
  Phi-4-mini put their analysis in `reasoning_content` (that's
  `--reasoning-format`'s `auto` default doing its job), and the UI renders it as
  a separate collapsible block. You get to see the model *think*, and judge
  whether that trace was worth the wait before pointing an agent at it.
- **Per-request sampling controls** — temperature, top-p, top-k, min-p, repeat
  penalty, and seed. Change them for one message without touching `config.ini`,
  which is exactly why the presets shouldn't hard-code your creative settings.
- **GBNF grammar support**, if you need the output constrained to a shape. The
  server has done this natively for a while; having it in the UI means you can
  test a grammar interactively before wiring it into a script.
- **Explicit model load and unload.** The UI calls `/models/load` and
  `/models/unload` directly, so you can free a model's memory on demand instead
  of waiting for `--sleep-idle-seconds` to expire. Handy when you've just
  finished with a 16GB MoE and want the RAM back now.
- **File upload and attachment** for the models that carry a multimodal projector.
- **Saved conversations**, so you can keep a thread per project and start fresh
  when one goes off the rails — far cheaper than restarting the server.

Note what's *not* there: the UI speaks chat completions only, so the 1.5B
fill-in-the-middle model is for scripted `POST /infill` use, not browser
autocomplete.

**Why it's worth using even though you have OpenCode.** The three clients answer different questions:

| Client | Best at | Cost |
|---|---|---|
| **Web UI** | Trying a model, watching reasoning, one-off questions, docs | Manual — you drive it |
| **OpenCode** | Multi-step coding work that touches files and runs tools | Slow on weak models; needs context budget tuning |
| **`curl`** | Scripting, health checks, wiring into scripts | Unpleasant for real conversation |

Reach for the browser first precisely *because* it's cheap. Swapping between gpt-oss-20b and the 30B coder to compare answers costs one dropdown click — you haven't committed to a model the way you have when you start an agent session that then walks a repo.

> [!NOTE]
> **If the browser shows a raw error instead of the UI, you're probably using `curl`.** The UI is served gzip-compressed, and a plain request without an `Accept-Encoding: gzip` header gets back a bare `415` reading `Error: gzip is not supported by this browser`. That's a false alarm — it means the server is fine and your *client* didn't negotiate compression. Real browsers always do:
>
> ```bash
> # 415? add --compressed and you get the actual page
> curl --compressed -s http://127.0.0.1:8080/ | head -5
> ```

> [!WARNING]
> **The UI has no authentication of any kind.** Anything that can reach port 8080
> can run inference on your machine, and `--tools` (built-in server-side tools for
> agents) plus `--ui-mcp-proxy` (an experimental MCP CORS proxy) both default to
> **off** for exactly that reason. That's why the unit above binds `127.0.0.1` —
> which also means a phone on your wifi can't reach it without a tunnel. Run this
> *on the phone* (in Termius, Blink, or whatever SSH client you use), then open
> `localhost:8080` in its browser:
>
> ```bash
> ssh -N -L 8080:127.0.0.1:8080 you@your-desktop-hostname
> ```
>
> Leave both flags off unless you understand what you're exposing.

> [!TIP]
> `--ui-config` / `--ui-config-file` pre-seeds the UI's own settings as JSON, so
> the page opens the way you like it instead of the way it happened to default.
> The catch is that the key names aren't documented in `llama-server --help` — it
> just says "JSON that provides default UI settings". They are the same keys the
> UI's Settings panel writes, so the reliable way to learn them is to change a
> setting in the browser once and read back what it stored. `customCss` (a string
> of CSS injected at runtime) is one confirmed example:
>
> ```bash
> # serve the UI with your own stylesheet, without editing the bundle
> llama-server ... --ui-config '{"customCss":"body{max-width:1100px}"}'
> ```
>
> And `--no-ui` turns the web server off entirely if you only ever talk to the
> API — worth doing on a shared box.

## Getting It Working Well With OpenCode

This section targets **OpenCode V2 — currently in beta**. The configuration below is V2's format; OpenCode V1 used a different, older schema, so this won't apply there. Because V2 is beta, flags and config keys can shift between releases — if something here doesn't match what your installed version accepts, the V2 documentation (opencode.ai/v2/docs) is the source of truth.

If you don't have it yet, the beta channel lives in the AUR:

```bash
yay -S opencode-beta   # pre-release channel; any AUR helper works
```

Stable V2 has also landed in the official repos (`sudo pacman -S opencode`), so skip the AUR if you don't want to track pre-releases — the config in this article was verified on `v2.0.15`.

OpenCode connects to any OpenAI-compatible endpoint through a custom provider. With llama-server running under systemd, add this to `~/.config/opencode/opencode.jsonc` (global) or your project's `opencode.jsonc`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "local/qwen3-coder-30b",
  "compaction": {
    "keep": { "tokens": 4096 }
  },
  "providers": {
    "local": {
      "name": "Local llama-server",
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": { "baseURL": "http://127.0.0.1:8080/v1", "timeout": 960000 },
      "models": {
        "qwen3-coder-30b": {
          "modelID": "qwen3-coder-30b",
          "name": "Qwen3 Coder 30B A3B (local)",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] },
          "limit": { "context": 57344, "output": 4096 },
          "compatibility": { "reasoningField": "reasoning_content" }
        },
        "gpt-oss-20b": {
          "modelID": "gpt-oss-20b",
          "name": "GPT-OSS 20B (local)",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] },
          "limit": { "context": 28672, "output": 4096 },
          "compatibility": { "reasoningField": "reasoning_content" }
        },
        "qwen2.5-coder-7b": {
          "modelID": "qwen2.5-coder-7b",
          "name": "Qwen2.5 Coder 7B Instruct (local)",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] },
          "limit": { "context": 28672, "output": 4096 }
        },
        "qwen3-8b": {
          "modelID": "qwen3-8b",
          "name": "Qwen3 8B (local)",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] },
          "limit": { "context": 28672, "output": 4096 },
          "compatibility": { "reasoningField": "reasoning_content" }
        },
        "gemma-4-26b": {
          "modelID": "gemma-4-26b",
          "name": "Gemma 4 26B A4B (local)",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] },
          "limit": { "context": 57344, "output": 2048 }
        },
        "magistral-small": {
          "modelID": "magistral-small",
          "name": "Magistral Small 2509 (local)",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] },
          "limit": { "context": 28672, "output": 2048 },
          "compatibility": { "reasoningField": "reasoning_content" }
        },
        "phi-4-mini": {
          "modelID": "phi-4-mini",
          "name": "Phi 4 Mini Reasoning (local)",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] },
          "limit": { "context": 14336, "output": 2048 },
          "compatibility": { "reasoningField": "reasoning_content" }
        },
        "qwen3-4b": {
          "modelID": "qwen3-4b",
          "name": "Qwen3 4B (local)",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] },
          "limit": { "context": 14336, "output": 2048 },
          "compatibility": { "reasoningField": "reasoning_content" }
        }
      }
    }
  }
}
```

What matters here:

- Each entry's `modelID` is the name the router exposes — the **section name from `config.ini` above** (also what `curl http://127.0.0.1:8080/v1/models` reports). The `models` key is the OpenCode selector, so `"qwen3-8b": { "modelID": "qwen3-8b", ... }` is selectable as `local/qwen3-8b`. All eight keep the two identical, and that's worth doing deliberately: because every preset names its file by path, *you* choose the section name, so the id stays short and stable instead of inheriting whatever the router's scan happened to call it. **Check `/v1/models` rather than guessing the id** — it's the authoritative list, and it will also show you a duplicate if a model got registered twice.
- You **must** set real `limit` values. OpenCode assumes a 200k context / 32k output fallback for unknown models, and will happily send prompts your little server rejects with `request exceeds the available context size`. Set `limit.context` ~10% **below** the server's `c` for that model (e.g. 57344 under the 65536 ceiling, 14336 under 16384) — the gap absorbs OpenCode's token-estimate fuzz and leaves room for output.
- The budget has a floor: OpenCode's fixed overhead (agent system prompt + tool schemas + any `AGENTS.md`/rule files) runs ~6–8k tokens *before a single word of conversation* — measured 8,351 on a tool-loaded coding repo. A 4k or 8k context can't even start a session; 12–16k is the practical minimum for this client.
- Set `settings.timeout` generously — milliseconds, so `960000` is 16 minutes. In router mode the first request to an unloaded model can spend minutes reading a multi-GB file before a single token arrives; with a short client timeout OpenCode aborts mid-load and the agent loop looks hung when it was only slow.
- Set `capabilities.tools` true only if the model genuinely supports tool calling — everything in the eight-model lineup does (the chat templates ship in the GGUF metadata, so the server applies them automatically); the 4B still counts, it's just less reliable at it.
- For thinking models, add `compatibility.reasoningField` on the model so chain-of-thought output displays properly. Qwen3 chat models, gpt-oss-20b, Magistral, and Phi-4-mini-reasoning all think by default; Gemma 4 doesn't, so it's left off. It's inert on a model where you've already switched thinking off server-side — `qwen3-8b` keeps the field for chat use, but its preset in `config.ini` ships with `reasoning = off`, which is exactly what makes it compaction-safe for OpenCode.

Then select it in a session with `/models`, or one-shot:

```bash
opencode run --model local/qwen3-coder-30b "Explain this repo in 3 bullet points"
```

### Making agentic use actually work well

- **Use a coder model, not a 4B.** Tool calling is where small models fall apart. The 7B or 8B coder family is the floor for reliable agent work.
- **Don't make gpt-oss-20b your OpenCode default.** It's the best answer in the lineup, but it's RAM-bound *and* a reasoning model, so you get the two failure modes at once: slow tool loops and a thinking trace that can corrupt OpenCode's compaction summary. It's configured with `reasoningField` so you can see the trace, which is exactly why you don't want it generating one on every agent step. Use it for chat and for hard one-off questions; use `qwen3-coder-30b` or the 7B coder for the loop.
- **Match the budgets.** The server's `c`, OpenCode's `limit.context`, and the compaction `keep` budget all have to be consistent — that's why the configs above run per-model ceilings (64k for the MoE pair, 32k for 8B/Magistral, 16k for the small models) with OpenCode budgets ~10% under each, and `compaction.keep.tokens` at 4096 (overhead + kept history must fit the budget).
- **Thinking models eat agent loops alive** — and can break OpenCode outright. A Qwen3/Magistral/Phi thinking trace of 500–2000 tokens per step, at single-digit tok/s, turns a five-step task into a coffee break; worse, the trace pollutes OpenCode's compaction summary and you get `Error: Compaction summary did not match the required template`. The fix is one preset key: `reasoning = off` (applied to `qwen3-8b` above) — no thinking pollution, dramatically faster loops, compaction-safe. Pick a non-thinking coder model (like `qwen3-coder-30b`) as your OpenCode default and reserve thinking models for chat.
- **Expect slower agent loops than cloud models.** Local 8B is great for refactors, explanations, and scoped edits. For hard architecture work, switch to the MoE 30B or accept the limits — that's the honest trade-off for privacy and zero cost.
- Your first tool-using request will be slower: in router mode that's the model loading — subsequent steps are much faster.

## Benchmarking and Sanity Check

`llama-bench` gives you a quick way to compare offload settings:

```bash
llama-bench -m ~/models/qwen3-8b-q4_k_m.gguf -ngl 0
llama-bench -m ~/models/qwen3-8b-q4_k_m.gguf -ngl 30
```

Expected territory on an RTX 3050 4GB (approximate, hardware-dependent — treat as ballpark, not spec):

| Config | Rough tok/s |
|---|---|
| 4B Q4, full GPU | 50–70 |
| 8B Q4, ~25 layers GPU | 20–35 |
| 8B Q4, CPU-only | lower than split — proves the GPU helps |
| 14B Q4, mostly CPU | 8–15 |
| 30B-A3B MoE, mostly CPU | better per-token than dense 14B thanks to only ~3B active |
| gpt-oss-20b MXFP4, mostly CPU | 4 of 32 experts active, so only a fraction of the weights move per token — but what's left is served from DDR4, not VRAM, and the analysis channel dominates. `reasoning_effort` moves this number more than any offload setting will |

Token generation is memory-bandwidth-bound, and the 3050's ~192 GB/s is what caps the GPU numbers. The MoE advantage is real on this rig: big-model quality at a fraction of the computing cost is why Qwen3-30B-A3B is the "quality" pick.

That last row is the one worth internalising. On a 4GB card, **the models large enough to be interesting are usually the ones the GPU cannot hold**, so above a few GB you're measuring your system RAM's bandwidth, not the GPU. Two consequences: offloading the first handful of layers still helps (attention is compute-heavy and its weights are tiny), but the returns vanish fast; and cutting *tokens generated* beats every offload tweak you could apply. Halving `reasoning_effort` on gpt-oss-20b is worth more than any amount of VRAM you could wish you had.

To measure your own numbers rather than trusting a table:

```bash
llama-bench -m ~/models/gemma-4-26B-A4B-it-Q4_K_M.gguf -ngl 0
llama-bench -m ~/models/gemma-4-26B-A4B-it-Q4_K_M.gguf -ngl auto
```

Run the same model at `-ngl 0` and `-ngl auto` and the difference is what your GPU is actually contributing. If it's small, stop tuning offload and start cutting context or reasoning length.

## Troubleshooting

- **`CUDA driver version is insufficient`** — driver/toolkit version mismatch; update the driver then the toolkit.
- **Model loads CPU-only** — check `-ngl`, watch `nvidia-smi` during load, and confirm
  `llama-cli --list-devices` lists the GPU *and* that `ggml-cuda` is installed (the
  base `llama-cpp` package alone has no CUDA backend).
- **OpenCode can't see the model or tool calls fail** — wrong `modelID`, or `capabilities.tools` set false. Check `curl http://127.0.0.1:8080/v1/models` for the exact id the router exposes; a stale `--chat-template` override or a pre-0.4.x build without Jinja enabled will also break tool calling.
- **gpt-oss-20b "calls" a browser or python tool that doesn't exist** — the harmony template advertises fake built-in tools unless you strip them. Confirm `"builtin_tools": []` survived in `chat-template-kwargs`; the JSON object is replaced wholesale, so editing it to add `reasoning_effort` can silently drop it.
- **gpt-oss-20b feels sluggish before it says anything** — it's RAM-bandwidth-bound and defaults to `reasoning_effort = "medium"`. Set `"low"` in the preset and restart the service.
- **Browser shows `415` or a raw gzip error instead of the chat UI** — a client that didn't send `Accept-Encoding: gzip`. Use a real browser, or add `curl --compressed`.
- **`GET /` returns a Web UI you don't want exposed** — bind `127.0.0.1` (the default) or pass `--no-ui`. The UI has no authentication.
- **RAM spike / OOM despite 64GB** — context too large; reduce `-c` (or the preset `c` key) and check KV cache type (`ctk`/`ctv`).
- **Long context gets slow, or VRAM is exhausted mid-session** — KV cache growth; leave that ~0.5GB headroom and/or shrink context.
- **Nouveau re-enabled after a kernel/driver update** — reinstall/verify the `nvidia-open` package and reboot.
- **Model behaves oddly after a llama.cpp upgrade** — stale GGUF; see the re-download notes above (section "Downloading Your First Model").
- **Ampere laptop crashes on suspend/resume** — known GSP-firmware issue with the open modules; use the proprietary `nvidia-580xx-dkms` driver with `NVreg_EnableGpuFirmware=0`.
- **Router mode says model not found** — `modelID`/preset section-name mismatch; check `curl http://127.0.0.1:8080/models` for the exact name the server expects.
- **Models stay loaded between uses** — `--models-max` too high or autoload behavior; use LRU with `--models-max 1` or an explicit `/models/unload` timer.
- **Context smaller than you configured** — `--fit` silently shrinks `c` when KV buffers don't fit (check load logs for `n_ctx_slot`; it's printed at every load). Keep `kv-unified = true` and `q8_0` KV caches (section above) so your configured ceiling survives.
- **OpenCode says `Compaction summary did not match the required template`** — a thinking model's chain-of-thought corrupted the compaction summary; set `reasoning = off` on that model in `config.ini` (or make a non-thinking coder model your OpenCode default).
- **Inch-worm generation (1–3 tok/s) with `failed to find free space in the KV cache, retrying with smaller batch size` in the logs** — shared KV pool exhaustion from concurrent long prompts (two OpenCode sessions, or title-gen + chat), and/or two model instances decoding at once. The server "recovers" by re-decoding tiny batches, which looks like a hang. Fix: unified KV + quantized caches, smaller `np`, and don't chat on two models simultaneously on a 4GB/16-core box.

## Conclusion

The recipe is: understand what model variants mean (instruct vs base, quants, dense vs MoE) → pick per tier (4B for snappiness, 8B coder as your default for coding, 30B-A3B MoE when quality wins, gpt-oss-20b when you want the best answer and can wait) → serve everything through one `llama-server` in router mode under systemd, loading models on demand so resources stay free until you actually need them → then consume it three ways: the built-in browser UI for chatting, `curl` for scripting and health checks, and OpenCode as a private offline coding assistant.

If you only take one thing from this, take the part that's counterintuitive: **on a 4GB card, most models worth using are ones the GPU can't fully hold.** Above roughly 5GB of *per-token* weight traffic, you're measuring your system RAM's bandwidth rather than the card, and no amount of offload tuning changes that. Note the qualifier — it's per-token traffic, not file size. An MoE like gpt-oss-20b is an 11.3GB file that only moves a fraction of itself each step, so it behaves far better than a dense 11.3GB model would.

Which leaves the wins that actually remain: reduce tokens generated, not layers offloaded. Shorter context, `reasoning_effort: "low"`, a smaller model. `llama-bench -ngl 0` against `-ngl auto` will show you whether your GPU is still earning its keep on a given model.

It won't replace a cloud model for the hardest work, but for privacy, no API bills, offline capability, and understanding how the whole stack fits together, this setup is genuinely useful — and your 64GB of RAM is the unsung hero of the whole thing.

If you want to go further, check the llama.cpp server documentation for router mode and presets, and the OpenCode providers guide for custom OpenAI-compatible endpoints.
