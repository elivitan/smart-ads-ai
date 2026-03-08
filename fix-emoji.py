path = r'app\routes\app.campaigns.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix all broken Unicode escapes to actual emoji characters
replacements = {
    '"\\U0001F680"': '"\U0001F680"',
    '"\\U0001F50D"': '"\U0001F50D"',
    '"\\U0001F4B0"': '"\U0001F4B0"',
    '"\\U0001F511"': '"\U0001F511"',
    '"\\U0001F4E2"': '"\U0001F4E2"',
    '"\\U0001F4C4"': '"\U0001F4C4"',
    '"\\U0001F6CD\\uFE0F"': '"\U0001F6CD\uFE0F"',
    '"\\U0001F6CF\\uFE0F"': '"\U0001F6CF\uFE0F"',
    '"\\U0001F4BE"': '"\U0001F4BE"',
    '"\\U0001F916"': '"\U0001F916"',
    '"\\u26A1"': '"\u26A1"',
    '"\\u23F3"': '"\u23F3"',
    '"\\u00D7"': '"\u00D7"',
    '"\\uFF0B"': '"\uFF0B"',
    '"\\u2014"': '"\u2014"',
    '"\\u00B7"': '"\u00B7"',
    '"\\u25B6"': '"\u25B6"',
    '"\\u23F8"': '"\u23F8"',
    '"\\u270F\\uFE0F"': '"\u270F\uFE0F"',
    '"\\u2192"': '"\u2192"',
    '"\\u2013"': '"\u2013"',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Fixed all emoji.")
