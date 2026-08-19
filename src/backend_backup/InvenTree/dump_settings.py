import sys
import os
import django
import json
import inspect

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'InvenTree.settings')
django.setup()

from common.setting.system import SYSTEM_SETTINGS
from common.setting.user import USER_SETTINGS

def get_default(v):
    default = v.get('default', '')
    if callable(default):
        return ''
    return str(default)

def clean_dict(d):
    clean = {}
    for k, v in d.items():
        # Handle callables in dicts
        clean[k] = {
            'name': str(v.get('name', '')),
            'description': str(v.get('description', '')),
            'default': get_default(v),
            'validator': 'bool' if v.get('validator') is bool else 'int' if v.get('validator') is int else 'string',
        }
    return clean

with open('settings_dump.json', 'w') as f:
    json.dump({'system': clean_dict(SYSTEM_SETTINGS), 'user': clean_dict(USER_SETTINGS)}, f, indent=2)
