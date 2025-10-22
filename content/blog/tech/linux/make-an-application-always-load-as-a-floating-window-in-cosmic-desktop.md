+++
date = "2025-10-14"
title = "Make an application always load as a floating window in Cosmic Desktop"
description = "Make an application always load as a floating window in Cosmic Desktop"
tags = ["Tech", "Linux", "Cosmic-Desktop"]
bannerId = "data-center"
draft = false
+++
I normally use Hyprland for my desktop environment because I like using tiling window managers and decided to try out Cosmic Desktop.

I primarily use the Cosmic Desktop as a tiling window manager and I want certain applications like the calculator to load as a floating window rather then being tiled.

At the time of writing this the only way to do this is by creating and editing a configuration file manually. This is not documented and I had to go searching forums and github issues to find out how to do this.

It is in the road map for Cosmic Desktop to allow users to set applications to load as floating windows using the Cosmic Settings but for now you can do it manually.

### Edit or create the following file:
**~/.config/cosmic/com.system76.CosmicSettings.WindowRules/v1/tiling_exception_custom**

```json
[
  //floating window applications
  (
    enabled: true,
    appid: "org.kde.kcalc",
    title: "KCalc",
  ),
  (
    enabled: true,
    appid: "second-app",
    title: "Second App",
  ),
]
```

All you need to do is save the file for the changes to take effect. You do not need to logout or restart the computer.
