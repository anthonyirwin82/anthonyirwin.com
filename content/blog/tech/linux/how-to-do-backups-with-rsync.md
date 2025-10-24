+++ 
Title = "How to do backups with rsync on Linux"
Description = "Comprehensive guide to using rsync for backups on Linux systems"
Date = 2025-10-24
Tags = ['Tech', 'Linux', 'Backup', 'Rsync']
Draft = false
+++
rsync is a powerful command line utility for efficiently copying and synchronizing files between Linux systems. It's particularly well suited for backups due to its ability to transfer only changed data, handle remote servers, and maintain file permissions.

## Why rsync is Good for Backups
1. **Efficient Data Transfer** - rsync only transfers the differences between source and destination files.
2. **Incremental Backups** - It can backup incremental changes rather than full copies.
3. **Remote Support** - rsync supports remote backups via SSH.
4. **File Permissions** - Preserves file permissions, timestamps, and ownership.
5. **Selective Excludes** - Can exclude specific files or directories with `--exclude`.

## Example Usage and Common Flags
### Basic Command
```bash
rsync -avz /source/ user@remote:/destination/
```
- `-a` = archive mode copies recursively and preserves permissions, timestamps, etc.
- `-v` = verbose output
- `-z` = files being transfered are compressed for faster transfer speeds

### Common Flags Explained
- `--delete` - Deletes files on the destination that don't exist on the source.
- `--exclude` - Excludes specific files or patterns (e.g., `--exclude="*.tmp"`)
- `--progress` - Shows progress of the transfer.

### Deleting Content on Remote Server
```bash
rsync -avz --delete /source/ user@remote:/destination/
```
This will delete files on the remote server that don't exist on the source, effectively pruning the remote directory to match the source.

## Setting Up SSH Keys for Remote Access
### 1. Generate SSH key pair:
```bash	
ssh-keygen -t ed25519 -C "your_email@example.com"
```
> [!IMPORTANT]
> You can leave the passphrase blank to use the ssh key without needing a password

> [!NOTE]
> This ssh key can also be used to authorize your computer with your Github account by adding it to the SSH and GPG keys section of the Github settings.
>
> The public key can be found at `~/.ssh/id_ed25519.pub`

### 2. Copy public key to remote server:
```bash	
ssh-copy-id user@remote-server
```
This command copies your public ssh key to the remote server allowing you to login automatically with out a passphrase or password providing the key you created does not require a passphrase.

### 3. Test connection:
```bash
ssh user@remote-server
```
> [!NOTE]
> If you created your ssh key without a passphrase then you should be able to login to the remote server without needing a password.

## Setting Up Cron Jobs for Automatic Backups
### Example Cron Job
```bash
crontab -e
```
Add this line to schedule backups:
```bash
0 2 * * * rsync -az --delete /source/ user@remote:/destination/
```
- Runs daily at 2 AM
- Uses rsync with archive mode and delete flag
- Backs up /source/ directory to remote server

## Why It's Important to Test Your rsync Backup

Testing your rsync backup is crucial because it ensures that you can actually restore data from the backup when needed. 
### Here’s why:

- **Verify The Backup Works**: Testing confirms that the backup contains everything that is needed to restore to a working state.
- **Reliability**: A backup is only useful if it works when you need it most. Testing helps identify issues before a disaster strikes.
- **Peace of Mind**: Knowing that your backups are reliable gives you confidence in your data protection strategy.
- **Compliance and Auditing**: Many organizations require proof that backups can be restored, especially in regulated industries.

In short, testing your rsync backup is not just a best practice it’s a necessity for data reliability and business continuity. You should test your backups over time to make sure that any changes to your computing environment are still covered by your backups.

## Conclusion
rsync is a versatile tool for Linux backups, offering efficiency, flexibility, and remote support. By understanding its flags and setting up SSH access, you can create robust backup solutions that keep your data safe and synchronized.

