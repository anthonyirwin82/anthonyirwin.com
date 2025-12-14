+++ 
Title = "How to setup a web development environment on Linux that has dynamic domains for your web applications"
Description = "Learn how to configure a professional local web development environment on Linux with dynamic wildcard domains (*.test, *.local), automatic SSL certificates, and Nginx reverse proxy for seamless multi-project development."
Date = 2025-12-13
Tags = ['Tech', 'Linux', 'Web-Dev']
Draft = false
+++
Working on multiple web projects locally can be tedious when you're constantly switching ports or editing hosts files. In this guide, I'll show you how to create a professional local development environment on Linux that automatically generates domains for any project in your `~/Websites/` directory.

By the end of this tutorial, you'll have:
- **Dynamic wildcard domains** - Any folder in `~/Websites/` automatically gets domains like `project-name.test`, `project-name.local`, etc.
- **Automatic HTTPS** - SSL certificates that work across all your local projects
- **Smart directory detection** - Nginx automatically serves from `/`, `/public/`, or `/_site/` depending on your project structure
- **PHP support** - Ready to run PHP applications via PHP-FPM

This setup works with popular frameworks like Laravel, Hugo, Jekyll, WordPress, and plain HTML/PHP projects without additional configuration.

## Install required packages
This will be setup to work with `NetworkManager` which most Linux Distros use by default because GUIs like Gnome and KDE require it to work with networking.

It also uses `systemd-resolved` as most Linux Distros are using this now.

You will need to install the following additional packages:

* dnsmasq
* nss
* mkcert
* nginx
* php
* php-fpm

### What each package does:
- **dnsmasq** - Lightweight DNS server that resolves our custom domains (*.test, *.local) to localhost
- **nss** - Name Service Switch libraries that allow system-level domain resolution
- **mkcert** - Creates locally-trusted SSL certificates for HTTPS development
- **nginx** - High-performance web server and reverse proxy
- **php & php-fpm** - PHP runtime and FastCGI Process Manager for running PHP applications

> [!NOTE]
> The exact package names may vary by distribution. On Arch-based systems, use `pacman -S`. On Debian/Ubuntu, use `apt install`. On Fedora, use `dnf install`.

We will be using dnsmasq from inside NetworkManager so make sure that it is not running and not setup to load when booting the computer.

```bash
sudo systemctl disable dnsmasq
sudo systemctl stop dnsmasq
```

If you want Nginx to start when booting the computer run the following command.
```bash
sudo systemctl enable nginx
```

If you want php support then run the following commands:
```bash
sudo systemctl enable php-fpm
sudo systemctl start php-fpm
```
> [!NOTE]
> Different distributions may have a different service name for php-fpm.
> Ubuntu uses php8.x-fpm as the service name. where 8.x is the version number.

## Setup Network Manager to use dnsmasq
Edit the `/etc/NetworkManager/conf.d/dnsmasq.conf` file or create it.
```bash
[main]
dns=dnsmasq
```

> [!NOTE]
> This configuration tells NetworkManager to use dnsmasq as its DNS resolver. When you request `myproject.test`, dnsmasq will intercept it and resolve it to `127.0.0.1` (localhost) instead of trying to look it up on the internet.

Create the `dnsmasq.d` directory if it doesn't exist.
```bash
sudo mkdir -p /etc/NetworkManager/dnsmasq.d
```

Create a config file for each of the local dynamic domains you want to create.

`/etc/NetworkManager/dnsmasq.d/test.conf`
```bash
address=/.test/127.0.0.1
```

`/etc/NetworkManager/dnsmasq.d/local.conf`
```bash
address=/.local/127.0.0.1
```

`/etc/NetworkManager/dnsmasq.d/localhost.conf`
```bash
address=/.localhost/127.0.0.1
```

`/etc/NetworkManager/dnsmasq.d/localdomain.conf`
```bash
address=/.localdomain/127.0.0.1
```

## Setup systemd-resolved
Edit `/etc/systemd/resolved.conf`
```bash
[Resolve]
DNS=127.0.0.1
Domains=~test ~local ~localhost ~localdomain
```

> [!NOTE]
> The tilde (`~`) prefix in `Domains=~test ~local` tells systemd-resolved to use these domains for **routing-only** DNS queries. This means these domains will be handled by our local dnsmasq instance at `127.0.0.1`, while other domains (like google.com) still use your regular DNS servers.

Restart the services to use the new configuration.

```bash
sudo systemctl restart systemd-resolved
sudo systemctl restart NetworkManager
```
> [!IMPORTANT]
> The order of restarting the service matters.

## Testing the dynamic domains work
To test the setup run the following command:
```bash
resolvectl status
```
In the Global section of the config you should see a listing for `DNS Domain: ~test ~local ~localhost ~localdomain`

You should see output similar to:
```bash
Global
  DNS Servers: 127.0.0.1
  DNS Domain: ~test ~local ~localhost ~localdomain
```

This confirms that your system is now routing these custom domains through your local DNS resolver.

Now try running some ping tests to make sure everything is working ok:
```bash
ping google.com
ping site.test
ping site.local
```
> [!TIP]
> Press CTRL + C to stop running the ping command.

## Setting up local ssl certificate for development
> [!IMPORTANT]
> mkcert uses a different root ca certificate for each user. The user that runs mkcert makes a difference.

```bash
mkcert -install
```
The command above installs a local root Certificate Authority (CA) for your system. While `mkcert` attempts to configure browser trust automatically, some browsers (especially Firefox) may still show security warnings on first visit.

> [!TIP]
> If you see an SSL warning in your browser, you can safely add a security exception for these local certificates. They're only valid on your machine and can't be used maliciously on the internet.

```bash
mkdir -p ~/Websites
cd ~/Websites
mkcert -cert-file local.pem -key-file local-key.pem "*.test" "*.local" "*.localhost" "*.localdomain" localhost 127.0.0.1 ::
```
The command above creates the ~/Websites directory then changes to that directory. Then it creates a local ssl certificate for the wildcard domains as well as localhost, 127.0.0.1 and ipv6 addresses.

```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp local.pem local-key.pem /etc/nginx/ssl
```
The above command creates a directory for the ssl certificates if it doesn't exist and then copies the ssl .pem files to the nginx ssl directory.

## Setting up Nginx
> [!NOTE]
> I have setup nginx using the sites-available and sites-enabled directories which is common in many distros. If your distro does not use this method then you can easily do it by adding `include /etc/nginx/sites-enabled/*.conf` inside the `http` section of the `/etc/nginx/nginx.conf` file.
>
> You then create a symbolic link from the sites-available config file to the sites-enabled directory e.g. `ln -s /etc/nginx/sites-available/website.conf /etc/nginx/sites-enabled`.

The Nginx configuration uses regular expressions to capture the subdomain (your project folder name) and dynamically set the document root. This means you never have to edit Nginx configs when creating new projects—just create a folder and it works!

**Key features of this config:**
- Automatically redirects HTTP to HTTPS
- Captures the project name from the domain using regex
- Checks for `/public/` (Laravel, Hugo) and `/_site/` (Jekyll) directories
- Falls back to the project root if neither exists
- Includes PHP-FPM support for PHP applications

Create the config files for each of the dynamic wildcard domains to work with nginx.

`/etc/nginx/sites-available/test.conf`:
```bash
server {
    listen 80;
    server_name ~^(?<site>[a-zA-Z0-9._-]+)\.test$;

    # Redirect all HTTP requests to HTTPS preserving host and URI
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name ~^(?<site>[a-zA-Z0-9._-]+)\.test$;

    ssl_certificate     /etc/nginx/ssl/local.pem;
    ssl_certificate_key /etc/nginx/ssl/local-key.pem;

    # Default root
    set $root_path /home/username/Websites/$site;

    # If public directory exists, override root
    if (-d /home/username/Websites/$site/public) {
        set $root_path /home/username/Websites/$site/public;
    }

    # If _site directory exists, override root.
    if (-d /home/username/Websites/$site/_site) {
        set $root_path /home/username/Websites/$site/_site;
    }

    root $root_path;
    index  index.php index.html index.htm;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Optional PHP-FPM support
    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php-fpm/php-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```
> [!IMPORTANT]
> Replace `username` in the paths `/home/username/Websites/` with your actual Linux username. You can find it by running `whoami` in the terminal.

> [!NOTE]
> The PHP-FPM socket path may differ on your distribution:
> - **Arch Linux**: `/run/php-fpm/php-fpm.sock`
> - **Ubuntu/Debian**: `/run/php/php8.x-fpm.sock` (replace 8.x with your PHP version)
> - **Fedora**: `/run/php-fpm/www.sock`
> 
> Check your distribution's PHP-FPM configuration to verify the correct path.

> [!NOTE]
> Each config file is the same except for 2 lines. A `server_name` line in both the `server` sections so I will not duplicate the config. 
> 
> You can copy the `test.conf` config file for `local.conf`, `localhost.conf` and `localdomain.conf` and change the relevent `server_name` lines.

I have listed all the server_name lines for your convenience.
```bash
server_name ~^(?<site>[a-zA-Z0-9._-]+)\.test$;
server_name ~^(?<site>[a-zA-Z0-9._-]+)\.local$;
server_name ~^(?<site>[a-zA-Z0-9._-]+)\.localhost$;
server_name ~^(?<site>[a-zA-Z0-9._-]+)\.localdomain$;
```

## Enabling the sites-available config files so Nginx uses them
```bash
ln -s /etc/nginx/sites-available/test.conf /etc/nginx/sites-enabled
ln -s /etc/nginx/sites-available/local.conf /etc/nginx/sites-enabled
ln -s /etc/nginx/sites-available/localhost.conf /etc/nginx/sites-enabled
ln -s /etc/nginx/sites-available/localdomain.conf /etc/nginx/sites-enabled
```

> [!NOTE]
> This method of having a `sites-available` and `sites-enabled` directories allows you to stop a website config file from being loaded in nginx by removing the symbolic link in the `sites-enabled` directory but leave the config file in place in the `sites-available` directory.

## Testing Nginx Setup
```bash
sudo nginx -t
```
If you get no errors from the above command then you can safely restart or start nginx.
```bash
sudo systemctl restart nginx
sudo systemctl status nginx
```
The above commands restart nginx and checks it's status. If nginx is not started then you can use start instead of restart in the systemctl command.

## Create Dummy Websites for testing
```bash
mkdir -p ~/Websites/html ~/Websites/php
```
The above commands creates a directory for testing html and php websites if they don't already exist.

Create the following files for testing:

`~/Websites/html/index.html`
```html
<h1>HTML is working.</h1>
```

`~/Websites/php/index.php`
```php
<?php
phpinfo();
```

## Testing Final Setup in a Web Browser
Now try running the websites in a web browser. You may get a untrusted ssl certificate warning if that is the case the add a security exception for the ssl certificate so the web browser trusts the certificate and loads the websites.

* https://html.test
* https://php.test

> [!NOTE]
> http://html.test and http://php.test should redirect to https. 
>
> The other .local, .localhost and .localdomain extensions should also work if you configured them.

## Troubleshooting Common Issues

### DNS not resolving
If `ping site.test` doesn't work:
1. Verify NetworkManager is using dnsmasq: `systemctl status NetworkManager`
2. Check dnsmasq is running: `ps aux | grep dnsmasq`
3. Confirm systemd-resolved configuration: `resolvectl status`

### Nginx 403 Forbidden Error
This usually means a permissions issue:
```bash
# Check that your Websites directory is readable
chmod 755 /home/your-username
chmod 755 ~/Websites
chmod 755 ~/Websites/your-project
```

### PHP files downloading instead of executing
1. Verify PHP-FPM is running: `systemctl status php-fpm`
2. Check the socket path in your Nginx config matches your system
3. Restart both services: `sudo systemctl restart php-fpm nginx`

### SSL Certificate Warnings Persist
If browsers continue showing warnings:
1. Try running `mkcert -install` again
2. For Firefox, manually import the CA: `mkcert -CAROOT` shows the certificate location
3. Alternatively, just add a security exception—it's safe for local development

## Conclusion

You now have a professional local web development environment that rivals production setups! With dynamic domains, automatic SSL, and smart directory detection, you can focus on building projects instead of configuring servers.

**What you've accomplished:**
- ✅ Automatic domain resolution for any project in `~/Websites/`
- ✅ HTTPS support with locally-trusted certificates
- ✅ Nginx configured to work with multiple framework structures
- ✅ PHP-FPM ready for PHP applications
- ✅ A scalable setup that grows with your projects

**Next steps:**
- Create new projects by simply making a folder in `~/Websites/`
- Create symbolic link from your git repos e.g. `ln -s ~/repos/laravel/laravel-project ~/Websites`
- Try different frameworks—Laravel, Hugo, Jekyll, or plain HTML all work out of the box
- Consider adding additional domains (like `*.dev`) by following the same pattern

This setup has saved me countless hours of configuration over the years. Whether you're building a simple HTML site or a complex PHP application, everything just works. Happy coding!

