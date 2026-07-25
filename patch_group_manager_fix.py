import re

with open("apps/orchestrator/frontend/src/components/GroupManager.tsx", "r") as f:
    content = f.read()

# 1. Remove state variables
content = re.sub(r"    const \[filterCategory, setFilterCategory\] = useState\('All'\)\n    const \[filterBrand, setFilterBrand\] = useState\('All'\)\n", "", content)

# 2. Remove Car Filters block
content = re.sub(r'                            \{/\* Car Filters \*/\}(.*?)\}\)\(\)\}\n', "", content, flags=re.DOTALL)

# 3. Remove filter logic inside the rig select
content = re.sub(r'                                                        // Apply category filter\n.*?                                                        // Apply brand filter\n.*?\n', "", content, flags=re.DOTALL)

with open("apps/orchestrator/frontend/src/components/GroupManager.tsx", "w") as f:
    f.write(content)

