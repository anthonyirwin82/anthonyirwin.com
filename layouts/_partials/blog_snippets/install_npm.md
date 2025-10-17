## Installing Node.js and npm

Below are instructions for installing on **Arch Linux**, **Ubuntu**, and **Fedora**.

### Arch Linux
```bash
sudo pacman -Syu nodejs npm
```

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install nodejs npm -y
```

### Fedora
```bash
sudo dnf install nodejs npm -y
```

You can verify the installation with:

```bash
node --version
npm --version
```
