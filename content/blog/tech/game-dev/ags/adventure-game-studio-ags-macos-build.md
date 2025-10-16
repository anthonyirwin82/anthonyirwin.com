+++
date = "2022-02-02"
title = "Adventure Game Studio AGS MacOS Build"
description = "How to play windows AGS games in a MacOS AGS Bundle and how to release your own games in a MacOS AGS Bundle with codesigning and notorization"
tags = ["Tech", "Game-Dev", "AGS"]
aliases = ["/adventure-game-studio-ags-macos-build/"]
draft = false
+++
{{<youtube LVTmtwvafp0>}}

**Please Note:** This was built on MacOS Monterey 12.2 on an Intel 64bit machine. The app has not been code signed or notarized with Apple so you will get warnings preventing you opening the app.

To run this app disable gatekeeper on the app by running the following command in the terminal:

```sh
xattr -dr com.apple.quarantine /path/to/ags-[version].app
```

**POWER USERS ONLY:** You can permanently disable gatekeeper for all applications. This should only be done if you are a power user and know what you are doing as you can accidentally run malicious applications without having Apples built in protection for average users.

To permanently disable gatekeeper for all applications run the command below in the terminal:

```sh
sudo spctl --master-disable
```

Or (depending on MacOS version)

```sh
sudo spctl --global-disable
```

## How to play Windows exe or AGS Data Game files using the MacOS AGS App Bundle:

1. Copy the windows game files or the AGS game data files to the clipboard.
2. In the finder highlight the ‘ags-[version].app’ file then right click the application then click ‘Show package contents’.
3. Go into the ‘Contents’ folder.
4. Go into the ‘Resources’ folder.
5. Paste the Windows game files or AGS game data files into the ‘Resources’ folder.
6. Rename the Windows AGS ‘[game name].exe’ file to be ‘[game_name].ags’. (for your own games that you have compiled you can used the ‘Compiled/Data’ files instead of using the windows engine .exe file)
7. Click back in finder until you are at the ‘ags-[version].app’ file.
8. Rename the ‘ags-[version].app’ file to be ‘[game name].app’.
9. cYou should now be able to open and run the ‘[game name].app’ ags game. If MacOS throws any errors then make sure that you have disabled gatekeeper protection on the file as shown below the download buttons above.


**Please Note:** I compiled these AGS MacOS Engine binaries for my own personal use and documented the process to help others that may want to do the same. I can not offer support for this other then the instructions on this page.

## How To Compile Adventure Game Studio AGS MacOS Engine

{{<youtube UfN2cxo-5Gw>}}
	
## Text Instructions Below Have Newer Information Then The Video

1. Go to https://github.com/adventuregamestudio/ags/releases and download the source code for the version you want to build.
2. Download and install Xcode from the Apple App Store if you do not have Xcode installed on your computer.
3. Go to https://brew.sh and install homebrew if you don’t already have it installed.
4. Open a terminal window and type the following command ‘brew install cmake’ this will install cmake onto your computer or update it if it is out of date.
5. In the terminal type ‘cd /path/to/ags/source/code’.
6. In the terminal type ‘mkdir build && cd build’.
7. In the terminal type ‘cmake -G Xcode ..’. This will take some time and when it is finished you will have an Xcode build file that is configured for your computer setup.
8. In finder go to the ‘[/path/to/ags/source/code]/build’ folder.
9. Open the ‘AGS.xcodeproj’ file in xcode by double clicking it.
10. In Xcode click the ‘Product’ menu then go down to the ‘Scheme’ menu then click ‘ALL_BUILD’. This will tell Xcode to build everything needed for the AGS MacOS Engine.
11. In Xcode at the top menu bar in the middle change ‘ALL_BUILD > My Mac’ to ‘ALL_BUILD > Any Mac’.
12. In Xcode click the ‘Product’ menu then click the ‘Build’ option. When this builds successfully you will have the ags engine for MacOS as a standalone file and as an application bundle.
13. In finder go to the ‘[/path/to/ags/source/code]/build/Debug’ folder. In this folder you will see the ags standalone file and the AGS.app bundle file.
14. Copy the ags standalone file or AGS.app and paste it into the folder with the ags game files.
15. Follow the instructions above named ‘How to play Windows exe or AGS Data Game files using the MacOS AGS App Bundle’ to setup the AGS.app application bundle to run the ags game files.

## Information for releasing you own game with code signing and notarization

For releasing your own games that you have compiled you can used the ‘Compiled/Data’ files instead of using the windows engine .exe file in the resources folder of the app bundle.

You should also change the ags.icns in the resources folder of the app bundle to be the icon for your game.

You should also change the Executable File, Get Info String, Bundle identifier, Bundle name, Bundle version and Copyright fields in the Info.plist file that is in the app bundle.

![](/assets/img/blog/tech/game-dev/ags/ags-info.plist.png) 

To code sign and notarize your app do the following:

```sh
codesign --force -v --sign "Your developer ID (your provider ID)" --options runtime --entitlements Entitlements.plist GameName.app

ditto -c -k --sequesterRsrc --keepParent *app yourGame.zip

xcrun altool --notarize-app --primary-bundle-id "your.bundle.id" --username your@email.com --password AppleOneTimePasswordHere --asc-provider YourProviderID --file yourGame.zip
```

After the notarization’s done, you can verify your game, and staple it for offline use:

```sh
codesign --verify --verbose=4 YourGame.app
spctl --verbose=4 --assess --type execute YourGame.app
spctl -a -v YourGame.app

xcrun stapler staple -v YourGame.app
stapler validate YourGame.app
```

Additionally, if you do any changes to your game bundle (like a little patch, update, even a small change in the Resources directory), you need to re-sign and re-notarize it again.

* if you wish to locally test your debug build with Steam/GOG dylibs, you need proper entitlements in your Entitlements.plist file (the one you use to sign the app), otherwise your game will crash and burn while trying to access Galaxy/Steam shared libs:

![](/assets/img/blog/tech/game-dev/ags/entitlements.plist.png) 

If you wish to quickly (re)build your game *.app bundle, you can use the following script in the build directory with the CMakeList.txt file:

```sh
export BUILD=release

mkdir build_$BUILD
cd build_$BUILD

cmake -DCMAKE_BUILD_TYPE=$BUILD ..
make
```

If you have any issues getting this working then you should check out the Adventure Game Studio forum which has answers to most questions. The forum post for the MacOS port of the AGS engine is [https://www.adventuregamestudio.co.uk/forums/index.php?topic=47264.260](https://www.adventuregamestudio.co.uk/forums/index.php?topic=47264.260)
