import os, glob, re

path = r'e:\BUBUY\3rd Year\MidtermMads\2ndTry\Frontend\frontend_parkingua\src\**\*.jsx'
files = glob.glob(path, recursive=True)

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = re.sub(r'[\'\"]http://127\.0\.0\.1:8000(/.*?)[\'\"]', r'`${import.meta.env.VITE_API_URL || \'http://127.0.0.1:8000\'}\1`', content)
    new_content = re.sub(r'[\'\"]http://127\.0\.0\.1:8000[\'\"]', r'(import.meta.env.VITE_API_URL || \'http://127.0.0.1:8000\')', new_content)
    
    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {os.path.basename(file)}')
