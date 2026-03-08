filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\market-intel.server.js"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

count = 0
if "function getUpcomingHolidays" in content and "export function getUpcomingHolidays" not in content:
    content = content.replace("function getUpcomingHolidays", "export function getUpcomingHolidays", 1)
    count += 1

if "function getSeasonalInsight" in content and "export function getSeasonalInsight" not in content:
    content = content.replace("function getSeasonalInsight", "export function getSeasonalInsight", 1)
    count += 1

if count > 0:
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"SUCCESS: Exported {count} functions")
else:
    print("Already exported or not found")
