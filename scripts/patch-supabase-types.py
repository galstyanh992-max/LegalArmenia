"""Post-process supabase-generated types.ts:
1. In Views: mark provably NOT NULL columns as non-nullable (verified against
   the app-schema base tables) and rebuild Insert/Update from Row for views
   that are writable through INSTEAD OF triggers (typegen emits `never` for
   cast columns like app_role::text even though the triggers accept them).
2. Duplicate those view definitions into Tables so existing
   Database['public']['Tables']['cases'] indexing keeps working.
3. Add compat enums (case_status/case_priority are CHECK-constrained text in
   the DB but the app treats them as closed unions).
Run after every `supabase gen types`."""
import re

PATH = '/home/user/LegalArmenia/src/integrations/supabase/types.ts'
src = open(PATH).read()

NONNULL = {
    'cases': ['id', 'title', 'status', 'priority', 'lawyer_id', 'created_at', 'updated_at'],
    'case_files': ['id', 'case_id', 'filename', 'original_filename', 'storage_path', 'version', 'created_at', 'updated_at'],
    'profiles': ['id', 'role', 'is_active', 'has_migrated', 'last_login_at', 'updated_at', 'created_at'],
    'user_roles': ['id', 'user_id', 'role'],
    'ai_analysis': ['id', 'case_id', 'created_at', 'sources_used'],
    'generated_documents': ['id', 'created_at', 'updated_at', 'status'],
    'case_members': ['id', 'case_id', 'user_id', 'case_role', 'created_at', 'updated_at'],
}
# Views whose INSTEAD OF triggers make all columns writable.
REBUILD_WRITES = {'cases', 'profiles', 'user_roles', 'ai_analysis', 'case_files', 'generated_documents'}

views_start = src.index('    Views: {')
funcs_start = src.index('    Functions: {')
views_block = src[views_start:funcs_start]

def find_block(container, name):
    m = re.search(rf'\n      {name}: {{\n', container)
    start = m.start() + 1
    rest = container[start:]
    end = re.search(r'\n      }\n', rest).end()
    return start, start + end

def optionalize(rowbody):
    out = []
    for line in rowbody.split('\n'):
        m2 = re.match(r'^          ([a-zA-Z_0-9]+): (.*)$', line)
        if m2:
            out.append(f'          {m2.group(1)}?: {m2.group(2)}')
        else:
            out.append(line)
    return '\n'.join(out)

patched = views_block
copies = []
for name, cols in NONNULL.items():
    s, e = find_block(patched, name)
    block = patched[s:e]
    rowm = re.search(r'(        Row: {\n)(.*?)(\n        })', block, re.S)
    rowbody = rowm.group(2)
    for col in cols:
        rowbody = re.sub(rf'^(          {col}: [^\n]*?) \| null$', r'\1', rowbody, flags=re.M)
    newblock = block[:rowm.start(2)] + rowbody + block[rowm.end(2):]
    if name in REBUILD_WRITES:
        insbody = optionalize(rowbody)
        if '        Insert: {' in newblock:
            newblock = re.sub(r'        Insert: {\n.*?\n        }', '        Insert: {\n' + insbody + '\n        }', newblock, count=1, flags=re.S)
            newblock = re.sub(r'        Update: {\n.*?\n        }', '        Update: {\n' + insbody + '\n        }', newblock, count=1, flags=re.S)
        else:
            rown = re.search(r'        Row: {\n.*?\n        }', newblock, re.S)
            synth = rown.group(0) + '\n        Insert: {\n' + insbody + '\n        }\n        Update: {\n' + insbody + '\n        }'
            newblock = newblock.replace(rown.group(0), synth, 1)
    elif '        Insert: {' not in newblock:
        insbody = optionalize(rowbody)
        rown = re.search(r'        Row: {\n.*?\n        }', newblock, re.S)
        synth = rown.group(0) + '\n        Insert: {\n' + insbody + '\n        }\n        Update: {\n' + insbody + '\n        }'
        newblock = newblock.replace(rown.group(0), synth, 1)
    patched = patched[:s] + newblock + patched[e:]
    copies.append(newblock)

src = src[:views_start] + patched + src[funcs_start:]

marker = '\n    }\n    Views: {'
idx = src.index(marker)
src = src[:idx] + '\n' + ''.join(copies).rstrip('\n') + src[idx:]

compat = (
    '      case_status: "open" | "in_progress" | "pending" | "closed" | "archived"\n'
    '      case_priority: "low" | "medium" | "high" | "urgent"\n'
)
enum_marker = '    Enums: {\n'
eidx = src.index(enum_marker) + len(enum_marker)
src = src[:eidx] + compat + src[eidx:]

open(PATH, 'w').write(src)
print('patched types.ts')
