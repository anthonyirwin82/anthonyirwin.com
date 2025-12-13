+++
date = '2025-10-17'
title = 'How to Setup Hugo Admonitions (Markdown Callouts in Hugo)'
description = 'By adding Hugo Admonitions to your website so you can easily add stylish note bars for things like tips, warnings, cautions, important information etc. You can do this quickly and easily directly using markdown.'
tags = ['Tech', 'Programming', 'Hugo']
bannerId = 'web-dev'
draft = false
+++
> [!TIP] The GitHub repo for Hugo Admonitions is at [https://github.com/KKKZOZ/hugo-admonitions](https://github.com/KKKZOZ/hugo-admonitions)

By adding Hugo Admonitions to your website so you can easily add stylish note bars for things like tips, warnings, cautions, important information etc. You can do this quickly and easily directly using markdown.

I used this feature with other systems and when looking into how to do this with Hugo I found blog/forum posts linking to a deleted github repo and for this reason I have decided to include the files inside my Hugo Website rather then using Hugo Modules or git submodules. This way I always have a working copy that I control and less risk of my website breaking due to deleted github repos.

## Downloading the GitHub repo and preparing it for inclusion to your Hugo website
Outside of your hugo installation run the following command:

```bash
git clone git@github.com:KKKZOZ/hugo-admonitions.git themes/hugo-admonitions --depth=1
```
> [!NOTE] The `--depth=1` tells git to only download the most current commit and not all the git history.

Now you need to delete the .git and .github directories from the theme download so it does not conflict with your repo.

```bash
rm -Rf themes/hugo-admonitions/.git
rm -Rf themes/hugo-admonitions/.github
```

Now you can copy the Hugo Admonitions theme into your Hugo website.

```bash
cp -Rf themes/hugo-admonitions /your/hugo/path/themes
cd /your/hugo/path
```

## Registering the Hugo Admonitions Theme
Inside your Hugo root directory edit your **hugo.toml** configuration file and set the theme to be the following:
```toml
theme = ['hugo-admonitions', 'your-theme-name']
```
The Hugo Admonitions theme must appear before your main theme.
This allows Hugo to load the admonition shortcodes and styles first.

> [!Warning] Your theme should be the last theme entry at the very end

You should now be able to use Hugo Admonitions inside your markdown files.

## Example Usage

I am going to provide a large list of the options that can be used. First you will see what it looks like on the website then you will see the markdown code on how to use them.

For a full list you should check out the Hugo Admonitions GitHub Demos at [https://github.com/KKKZOZ/hugo-admonitions/blob/main/docs/content/demo.md?plain=1](https://github.com/KKKZOZ/hugo-admonitions/blob/main/docs/content/demo.md?plain=1)


#### GitHub Style

> [!NOTE]
> Useful information that users should know, even when skimming content.

```markdown
> [!NOTE]
> Useful information that users should know, even when skimming content.
```

> [!TIP]
> Helpful advice for doing things better or more easily.

```markdown
> [!TIP]
> Helpful advice for doing things better or more easily.
```

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

```markdown
> [!IMPORTANT]
> Key information users need to know to achieve their goal.
```

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

```markdown
> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.
```

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

```markdown
> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.
```

---

#### Callout Style

> [!ABSTRACT]
> Abstract: This paper discusses the advantages and challenges of microservice architecture.

```markdown
> [!ABSTRACT]
> Abstract: This paper discusses the advantages and challenges of microservice architecture.
```

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

```markdown
> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.
```

> [!CODE]
> Code snippet:
>
> ```javascript
> function fetchData() {
>     return axios.get('/api/data');
> }
> ```

```markdown
> [!CODE]
> Code snippet:
>
> ```javascript
> function fetchData() {
>     return axios.get('/api/data');
> }
> ```
```

> [!CONCLUSION]
> Conclusion: Based on the analysis above, we've decided to implement Docker containerization.

```markdown
> [!CONCLUSION]
> Conclusion: Based on the analysis above, we've decided to implement Docker containerization.
```

> [!DANGER]
> Danger! Critical security vulnerability detected in the system. Immediate action required.

```markdown
> [!DANGER]
> Danger! Critical security vulnerability detected in the system. Immediate action required.
```

> [!ERROR]
> Error: Unable to connect to database. Please check your connection settings.

```markdown
> [!ERROR]
> Error: Unable to connect to database. Please check your connection settings.
```

> [!EXAMPLE]
> Example:
>
> ```python
> def hello_world():
>     print("Hello, World!")
> ```

```markdown
> [!EXAMPLE]
> Example:
>
> ```python
> def hello_world():
>     print("Hello, World!")
> ```
```

> [!EXPERIMENT]
> Experiment: Testing the impact of new caching strategies on system performance.

```markdown
> [!EXPERIMENT]
> Experiment: Testing the impact of new caching strategies on system performance.
```

> [!GOAL]
> Goal: Reduce service response time by 30% by the end of this quarter.

```markdown
> [!GOAL]
> Goal: Reduce service response time by 30% by the end of this quarter.
```

> [!IDEA]
> Idea: Implement a machine learning-based code quality detection system.

```markdown
> [!IDEA]
> Idea: Implement a machine learning-based code quality detection system.
```

> [!SUCCESS]
> Congratulations! Your code has been successfully deployed to production.

```markdown
> [!SUCCESS]
> Congratulations! Your code has been successfully deployed to production.
```

> [!TASK]
> To-do list:
> - Update documentation  
> - Deploy new version

```markdown
> [!TASK]
> To-do list:
> - Update documentation  
> - Deploy new version
```

> [!TIP]
> Helpful advice for doing things better or more easily.

```markdown
> [!TIP]
> Helpful advice for doing things better or more easily.
```

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

```markdown
> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.
```

---

#### Header Only Style

> [!ABSTRACT] This paper discusses the advantages of microservice architecture

```markdown
> [!ABSTRACT] This paper discusses the advantages of microservice architecture
```

> [!CAUTION] Ensure all tests pass before merging to main branch

```markdown
> [!CAUTION] Ensure all tests pass before merging to main branch
```

> [!CODE] Execute `npm install` to install all dependencies

```markdown
> [!CODE] Execute `npm install` to install all dependencies
```

> [!CONCLUSION] We've decided to implement Docker containerization

```markdown
> [!CONCLUSION] We've decided to implement Docker containerization
```

> [!DANGER] Critical security vulnerability detected in the system

```markdown
> [!DANGER] Critical security vulnerability detected in the system
```

> [!ERROR] Error: Unable to connect to database. Please check your connection settings

```markdown
> [!ERROR] Error: Unable to connect to database. Please check your connection settings
```

> [!EXAMPLE] Git commit message format: "feat: add user authentication"

```markdown
> [!EXAMPLE] Git commit message format: "feat: add user authentication"
```

> [!EXPERIMENT] Testing new caching strategy with Redis

```markdown
> [!EXPERIMENT] Testing new caching strategy with Redis
```

> [!GOAL] Reduce service response time by 30% by the end of this quarter

```markdown
> [!GOAL] Reduce service response time by 30% by the end of this quarter
```

> [!IDEA] Implement a machine learning-based code quality detection system

```markdown
> [!IDEA] Implement a machine learning-based code quality detection system
```

> [!IMPORTANT] Please review and update your security settings

```markdown
> [!IMPORTANT] Please review and update your security settings
```

> [!INFO] Current system status: All services are operating normally with 99.9% uptime

```markdown
> [!INFO] Current system status: All services are operating normally with 99.9% uptime
```

> [!MEMO] Technical review meeting scheduled for next Tuesday at 2:00 PM

```markdown
> [!MEMO] Technical review meeting scheduled for next Tuesday at 2:00 PM
```

> [!NOTE] Always backup your data before performing system updates

```markdown
> [!NOTE] Always backup your data before performing system updates
```

> [!NOTIFY] System notification: Your password will expire in 30 days

```markdown
> [!NOTIFY] System notification: Your password will expire in 30 days
```

> [!QUESTION] How can we optimize database query performance?

```markdown
> [!QUESTION] How can we optimize database query performance?
```

> [!QUOTE] "Code is like humor. When you have to explain it, it's bad." - Cory House

```markdown
> [!QUOTE] "Code is like humor. When you have to explain it, it's bad." - Cory House
```

> [!SUCCESS] Congratulations! Your code has been successfully deployed to production

```markdown
> [!SUCCESS] Congratulations! Your code has been successfully deployed to production
```

> [!TASK] Review and update API documentation by Friday

```markdown
> [!TASK] Review and update API documentation by Friday
```

> [!TIP] Use `Ctrl + C` to quickly terminate a running program

```markdown
> [!TIP] Use `Ctrl + C` to quickly terminate a running program
```

> [!WARNING] Warning: This operation will delete all data

```markdown
> [!WARNING] Warning: This operation will delete all data
```

## Conclusion
If you have set this up correctly then you should be able to use Hugo Admonitions in your markdown to quickly and easily create stylish note bars.
