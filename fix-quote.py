path = r'app\routes\app.campaigns.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'flexDirection:"column"" }}>',
    'flexDirection:"column" }}>'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Fixed double quote.")
