#!/bin/bash

OUTPUT="crm_full_code.md"
echo "# Full Codebase Export" > $OUTPUT
echo "" >> $OUTPUT

# Function to append file content
append_file() {
    FILE=$1
    if [ -f "$FILE" ]; then
        echo "## File: $FILE" >> $OUTPUT
        echo '```typescript' >> $OUTPUT
        cat "$FILE" >> $OUTPUT
        echo '```' >> $OUTPUT
        echo "" >> $OUTPUT
        echo "Exported $FILE"
    fi
}

# Config files
append_file "package.json"
append_file "tsconfig.json"
append_file "vite.config.ts"
append_file "tailwind.config.js"
append_file "index.html"

# Source files
find src -name "*.tsx" -o -name "*.ts" -o -name "*.css" | sort | while read -r file; do
    append_file "$file"
done

echo "Export complete: $OUTPUT"
