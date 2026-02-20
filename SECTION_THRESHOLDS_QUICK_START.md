# Section Thresholds - Quick Start

## What You Asked For ✅

You can now **independently control play count thresholds** for:
- Featured Artists section
- Global Trending tab
- Trending Near You tab
- Blowing Up tab
- New Releases section
- Trending Albums section

Each section has its own threshold and changes to one **don't affect the others**.

## How to Access

1. Go to **Admin Dashboard**
2. Click **"Section Thresholds"** (under Content in sidebar)
3. Edit any section's thresholds
4. Click **Save**
5. Changes apply **immediately**!

## What You Can Control

For each section:
- **Min Play Count** - How many plays required
- **Min Like Count** - How many likes required
- **Time Window** - Last X days (or all time)
- **Enable/Disable** - Turn section on/off
- **Notes** - Remember why you set these values

## Example Use Cases

### New App (Few Users)
Set **low thresholds** so sections aren't empty:
```
Global Trending: 15 plays
Trending Near You: 10 plays
Blowing Up: 10 plays
```

### Growing App
Gradually **increase quality**:
```
Global Trending: 50 plays
Trending Near You: 30 plays
Blowing Up: 25 plays
```

### Established App
**High standards** for premium sections:
```
Featured Artists: 100 plays
Global Trending: 75 plays
Trending Near You: 40 plays
```

### Different Standards Per Section
```
Featured Artists: 100 plays (premium quality)
Trending Near You: 30 plays (local discovery)
New Releases: 10 plays (give new artists a chance)
```

## Quick Tips

✅ Start low, increase gradually
✅ "Trending Near You" should be lower than "Global Trending"
✅ "New Releases" should be lowest (discovery)
✅ Check sections weekly and adjust
✅ Empty section? Lower threshold
✅ Too much content? Raise threshold

## Default Settings (Already Configured)

| Section | Plays | Likes | Days |
|---------|-------|-------|------|
| Featured Artists | 100 | 10 | All |
| Global Trending | 50 | 5 | 14 |
| Trending Near You | 30 | 3 | 14 |
| Blowing Up | 25 | 2 | 7 |
| New Releases | 10 | 1 | 30 |
| Trending Albums | 75 | 8 | 14 |

Feel free to adjust these based on your app's size and content!

## Technical Details

- **Database Table:** `content_section_thresholds`
- **Migration:** `create_content_section_thresholds`
- **Admin UI:** `ContentSectionThresholdsManager`
- **Security:** RLS enabled, admin-only writes
- **Effect:** Immediate (no restart needed)

---

**Full Documentation:** See `CONTENT_SECTION_THRESHOLDS_GUIDE.md` for detailed info

**Questions?** The admin UI has helpful tooltips and descriptions for each field.
