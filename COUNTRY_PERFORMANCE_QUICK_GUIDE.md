# Country Performance Dashboard - Quick Reference Guide

## Access
**Path:** Admin Dashboard → Country Performance (Globe icon 🌍)
**Access Level:** Admin only

---

## Quick Overview

### 6 KPI Cards at the Top
1. **Active Countries** - How many countries have users
2. **Total Users** - All users across all countries
3. **Total Engagement** - Total plays + views
4. **Total Revenue** - Ad revenue + Treat purchases (USD)
5. **Top Revenue** - Which country generates most revenue
6. **Fastest Growth** - Which country is growing fastest

---

## View Modes

### Overview Charts (Visual Analytics)
**6 Interactive Charts:**
- Top 10 by Users
- Top 10 by Revenue
- Top 10 by Engagement
- Revenue Sources Breakdown
- Gender Distribution
- Listeners vs Creators

**Best For:** Presentations, quick insights, identifying trends

---

### Detailed Table (Raw Data)
**All Metrics in One Table:**
- Country, Users, Active, Listeners/Creators
- Plays, Views, Ad Revenue, Treat Revenue
- Gross Earnings, Withdrawn, Balance
- Growth percentages

**Best For:** Deep analysis, exporting, comparing specific metrics

---

## Time Ranges
- **7 Days** - Last week's activity
- **30 Days** - Last month (default)
- **90 Days** - Last quarter
- **All Time** - Entire history

**Note:** Growth % compares current period vs previous period of same length

---

## Key Metrics Explained

### Revenue Breakdown
```
Ad Revenue Total = Money from ads
├─ 50% goes to Creators
├─ 10% goes to Listeners
└─ 40% goes to Platform

Treat Revenue = Money from Treat purchases (USD)

Gross Earnings = Total ever earned
Current Balance = Available now
Withdrawn = Already paid out
```

### Growth Indicators
- **Green ↑** = Growing (positive %)
- **Red ↓** = Declining (negative %)
- **Gray 0%** = No change

---

## Common Tasks

### Export Data
1. Filter/sort as desired
2. Click "Export CSV" button (top right)
3. File downloads with current data

### Find Top Revenue Country
1. Switch to "Detailed Table" mode
2. Click "Ad Revenue" or "Treat Revenue" in sort dropdown
3. Ensure sort order is "↓ Desc"
4. Top row = highest revenue

### Identify Growth Opportunities
1. Set time range to "30 Days"
2. Switch to "Overview Charts"
3. Look at "Top 10 by Users" chart
4. Countries with high growth = opportunities

### Compare Countries
1. Use search bar to find specific country
2. View metrics in table mode
3. Export to Excel for side-by-side comparison

---

## Data Accuracy Notes

### Country Detection
- Uses **IP geolocation** from playback history (most accurate)
- Falls back to user profile country if no playback data
- Automatically normalizes (Nigeria → NG)

### Revenue Tracking
- **Gross Earnings** = Lifetime total earned
- **Current Balance** = Available balance now
- **Formula:** Gross = Current + Withdrawn

### User Counts
- **Total Users** = All users from this country
- **Active Users** = Users with activity in selected period
- **New Users** = Signed up during selected period

---

## Best Practices

### For Marketing
✅ Use 30-day range for monthly reports
✅ Focus on "Fastest Growing" country
✅ Export data for stakeholder presentations
✅ Track user growth % month-over-month

### For Finance
✅ Use "All Time" for lifetime revenue tracking
✅ Compare Gross vs Withdrawn for cash flow
✅ Monitor Ad + Treat revenue trends
✅ Sort by revenue to find top markets

### For Content Strategy
✅ Compare Plays vs Views ratio
✅ High plays = music preference
✅ High views = video preference
✅ Use to guide content curation per country

---

## Troubleshooting

### No Data Showing?
- Try "All Time" range
- Check if users have set country in profile
- Verify playback history exists

### Numbers Look Off?
- Ensure same time range as other reports
- Gross Earnings includes withdrawn amounts
- Growth % compares to previous equal period

### Can't Export?
- Check browser popup blocker
- Ensure data is loaded (not loading state)
- Try different browser if issue persists

---

## Tips & Tricks

💡 **Keyboard Shortcuts**
- Press Tab to navigate between filters
- Enter to apply search
- Arrow keys in dropdowns

💡 **Best View**
- Charts for high-level overview
- Table for specific metrics
- Export for external analysis

💡 **Growth Analysis**
- Compare 30d vs 90d to see acceleration
- Negative growth = need retention efforts
- High growth + low users = expansion opportunity

💡 **Revenue Optimization**
- Countries with high users but low revenue = untapped potential
- Focus ad placement in high-engagement countries
- Treat purchases show spending power

---

## Support

**Issues?** Check the main implementation doc: `COUNTRY_PERFORMANCE_IMPLEMENTATION.md`

**Feature Requests?** Document in project issues

**Data Questions?** Review "Data Accuracy Notes" section above

---

## Quick Stats (What's Measured)

**User Metrics** (7)
- Total, Active, New, Listeners, Creators, Male, Female, Other

**Engagement Metrics** (4)
- Plays, Views, Avg Plays/User, Avg Views/User

**Revenue Metrics** (10)
- Ad Total, Ad Creators, Ad Listeners, Ad Platform
- Treat Revenue, Treat Spent
- Curator Earnings
- Gross Earnings, Current Balance, Withdrawn

**Growth Metrics** (2)
- User Growth %, Plays Growth %

---

**Total: 23 metrics per country** 📊
