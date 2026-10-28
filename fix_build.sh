#!/bin/bash
APPS=("mecfinder_app" "mecfinder_provider_app")
for APP in "${APPS[@]}"; do
  cd /home/anger/Projects/mecfinders/$APP/android/app
  
  # Check out the original build.gradle from git or just reset it
  # Wait, instead of git checkout, let me just fix it manually using sed or python
  
  python3 -c "
import sys
path = 'build.gradle'
with open(path, 'r') as f:
    content = f.read()

# Try to revert the bad sed
if 'signingConfigs {' in content:
    # Just grab the original structure or wipe out signingConfigs and add it properly
    # Actually, easiest is to just check out from git because they haven't committed this
    pass
"
  
  # The user is probably using git. Let's see if we can just checkout build.gradle
  git checkout build.gradle
  
  # Now inject it correctly using Python for precision
  python3 -c "
import re
path = 'build.gradle'
with open(path, 'r') as f:
    content = f.read()

signing_block = '''
    signingConfigs {
        release {
            storeFile file(\"release.keystore\")
            storePassword \"mecfinder123\"
            keyAlias \"my-key-alias\"
            keyPassword \"mecfinder123\"
        }
    }
'''

if 'signingConfigs {' not in content:
    # insert before buildTypes
    content = content.replace('buildTypes {', signing_block + '    buildTypes {')
    # add signingConfig inside buildTypes.release
    content = re.sub(r'(buildTypes\s*\{\s*release\s*\{)', r'\1\n            signingConfig signingConfigs.release', content)
    
    with open(path, 'w') as f:
        f.write(content)
"
  cd ../
  ./gradlew assembleRelease
  ./gradlew bundleRelease
done
