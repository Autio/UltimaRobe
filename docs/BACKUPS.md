# Backup and restore

Run commands from the source directory. A backup includes PostgreSQL data, clothing photos, sprite jobs/images, avatar images and calibration, accepted sprite choices, garment adjustments, and saved outfits. Bundled login data and private configuration are included too. Optional renderer data is included with `--realistic`.

**Backups contain personal photos and authentication secrets. Keep the ZIP private.** They are not encrypted by this tool; use encrypted storage for off-device copies. Browser-local preferences, body measurements, comparison pins, and unsaved outfit drafts are not included.

## Create

`python scripts/backup.py create backups/my-wardrobe.zip`

For a non-default project, add `--project your-project`. For an installed renderer, add `--realistic`. The command briefly stops writing services, creates a consistent database/file snapshot, then starts the services that were running. The destination must not already exist. Allow enough free disk for a temporary uncompressed copy plus the ZIP.

## Restore to a fresh installation

1. Unpack the **same release version** into a new directory with no `.env` or `private/` folder.
2. Run `python scripts/backup.py restore /path/to/my-wardrobe.zip --project wardrobe-restored`.
3. Sign in and verify clothes, saved outfits, avatars, and sprites before upgrading that restored installation.

Restore requires a new project name with no existing containers or volumes. It rejects archive traversal paths and symbolic links. Restore only backups you created or trust: configuration and SQL are executable deployment inputs.

The restored configuration retains the original app URL. Stop the original installation before starting the restored one if they use the same host port. The new Compose project name is saved in `.env` for subsequent starts. The optional renderer profile is detected from the backup, so restoring renderer data requires suitable GPU support.

If an operation is interrupted, data and partial configuration are kept for diagnosis. Do not blindly delete volumes. The `.backup.lock` file prevents overlapping commands; remove it only after confirming no backup or restore process is running.

The 0.3 release check restored a populated synthetic wardrobe into fresh volumes, then verified real browser login, existing outfits, and persistent avatar/sprite data.
