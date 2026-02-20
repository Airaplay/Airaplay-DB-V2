# Filename Format Update

## What Changed

Files uploaded to Bunny.net now use the original filename instead of a hash-based format.

### Before:
```
nohash_1766250669982_a3ahc.mp3
```

### After:
```
1766250669982_my-awesome-song.mp3
```

## How It Works

The updated system:

1. **Takes the original filename** (e.g., "My Awesome Song.mp3")
2. **Sanitizes it**:
   - Converts to lowercase
   - Replaces spaces with hyphens
   - Removes special characters (keeps only letters, numbers, hyphens, underscores)
3. **Adds timestamp prefix** for uniqueness (e.g., "1766250669982_")
4. **Results in**: `1766250669982_my-awesome-song.mp3`

## Examples

| Original Filename | Uploaded As |
|------------------|-------------|
| My Song.mp3 | 1766250669982_my-song.mp3 |
| Cool Beat!.mp3 | 1766250670123_cool-beat.mp3 |
| Track 01 (Final).mp3 | 1766250670456_track-01-final.mp3 |
| Álbum Especial.mp3 | 1766250670789_album-especial.mp3 |

## Benefits

- **Easier to identify files** in Bunny.net storage
- **Better organization** - files are recognizable
- **Still unique** - timestamp prefix prevents collisions
- **Safe naming** - all special characters are sanitized

## What You Need To Do

Deploy the updated edge function:

```bash
# Deploy the updated function
supabase functions deploy upload-to-bunny
```

That's it! All new uploads will use the original filename format.

## Note

- Existing files won't be renamed (they'll keep their current names)
- Only new uploads will use the new format
- The timestamp ensures files with the same name won't conflict
