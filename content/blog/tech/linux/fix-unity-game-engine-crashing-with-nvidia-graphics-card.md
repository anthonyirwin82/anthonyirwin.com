+++
date = "2023-05-15"
title = "Fix Unity Game Engine Crashing With Nvidia Graphics Card"
description = "This article describes a solution for fixing Unity Game Engine crashes when using NVIDIA graphics cards on Linux systems"
bannerId = "web-dev"
tags = ["Tech", "Linux"]
draft = false
+++
A couple of years ago I was having issues with the Unity Editor randomly crashing on me. I tried many thing such as ```prime-run``` etc without success.

I found through trial and error from multiple forum posts that launching Unity Hub with the following worked well for me and stoped the random crashing issues.

I am posting this just in case I need it again and hopefully others will find it helpful.

**unityhub-nvidia.sh**
{{< highlight shell >}}
#!/usr/bin/env bash
__NV_PRIME_RENDER_OFFLOAD=1
__VK_LAYER_NV_optimus=NVIDIA_only
__GLX_VENDOR_LIBRARY_NAME=nvidia
/opt/unityhub/unityhub-bin "$@"
{{< / highlight >}}
