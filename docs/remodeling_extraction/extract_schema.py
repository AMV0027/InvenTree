import os
import ast
import json
from pathlib import Path

def get_node_value(node):
    if node is None:
        return ""
    if isinstance(node, ast.Constant):
        return repr(node.value)
    elif isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        return f"{get_node_value(node.value)}.{node.attr}"
    elif isinstance(node, ast.Call):
        func_name = get_node_value(node.func)
        # Handle translation functions like _() or gettext_lazy()
        if func_name in ('_', 'gettext', 'gettext_lazy', 'gettext_noop'):
            if node.args:
                return get_node_value(node.args[0])
        args_str = ", ".join(get_node_value(arg) for arg in node.args)
        kwargs_str = ", ".join(f"{kw.arg}={get_node_value(kw.value)}" for kw in node.keywords)
        parts = [p for p in (args_str, kwargs_str) if p]
        return f"{func_name}({', '.join(parts)})"
    elif isinstance(node, ast.Tuple) or isinstance(node, ast.List):
        elts = [get_node_value(elt) for elt in node.elts]
        return f"[{', '.join(elts)}]" if isinstance(node, ast.List) else f"({', '.join(elts)})"
    elif isinstance(node, ast.Dict):
        pairs = []
        for k, v in zip(node.keys, node.values):
            pairs.append(f"{get_node_value(k)}: {get_node_value(v)}")
        return "{" + ", ".join(pairs) + "}"
    elif isinstance(node, ast.BinOp):
        return f"{get_node_value(node.left)} {get_node_value(node.op)} {get_node_value(node.right)}"
    return ast.dump(node)

def parse_model_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    try:
        tree = ast.parse(content, filename=filepath)
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
        return []

    models = []

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            # Check if it's a Django model (usually has bases like models.Model, MetadataMixin, etc.)
            # We'll extract all classes, but filter out nested or non-model ones if they don't have fields
            class_name = node.name
            docstring = ast.get_docstring(node) or ""
            
            bases = [get_node_value(base) for base in node.bases]
            
            fields = []
            meta_info = {}
            
            for subnode in node.body:
                # Parse Meta class
                if isinstance(subnode, ast.ClassDef) and subnode.name == "Meta":
                    for meta_node in subnode.body:
                        if isinstance(meta_node, ast.Assign):
                            for target in meta_node.targets:
                                if isinstance(target, ast.Name):
                                    meta_info[target.id] = get_node_value(meta_node.value)
                
                # Parse Fields
                elif isinstance(subnode, ast.Assign):
                    # We expect target to be a Name (the field name) and value to be a Call (e.g. models.CharField)
                    for target in subnode.targets:
                        if isinstance(target, ast.Name):
                            field_name = target.id
                            if isinstance(subnode.value, ast.Call):
                                call_node = subnode.value
                                field_type_full = get_node_value(call_node.func)
                                
                                # Extract properties
                                help_text = ""
                                relation_to = ""
                                is_null = "False"
                                is_blank = "False"
                                default_val = ""
                                max_length = ""
                                
                                for kw in call_node.keywords:
                                    val_str = get_node_value(kw.value)
                                    if kw.arg == "help_text":
                                        help_text = val_str.strip("'\"")
                                    elif kw.arg == "to":
                                        relation_to = val_str.strip("'\"")
                                    elif kw.arg == "null":
                                        is_null = val_str
                                    elif kw.arg == "blank":
                                        is_blank = val_str
                                    elif kw.arg == "default":
                                        default_val = val_str
                                    elif kw.arg == "max_length":
                                        max_length = val_str
                                
                                # Sometimes foreign keys are positional arguments
                                if "ForeignKey" in field_type_full or "OneToOneField" in field_type_full or "ManyToManyField" in field_type_full:
                                    if call_node.args and not relation_to:
                                        relation_to = get_node_value(call_node.args[0]).strip("'\"")

                                # Determine if this looks like a Django model field
                                # It usually has a .Field suffix, or is a ForeignKey, etc.
                                if any(x in field_type_full for x in ("Field", "ForeignKey", "OneToOne", "ManyToMany")):
                                    fields.append({
                                        "name": field_name,
                                        "type": field_type_full,
                                        "help_text": help_text,
                                        "relation_to": relation_to,
                                        "null": is_null,
                                        "blank": is_blank,
                                        "default": default_val,
                                        "max_length": max_length
                                    })
            
            # Keep the class if it has fields or looks like a model
            if fields or any("Model" in base or "Mixin" in base for base in bases):
                models.append({
                    "name": class_name,
                    "bases": bases,
                    "docstring": docstring,
                    "fields": fields,
                    "meta": meta_info
                })
                
    return models

def main():
    base_dir = Path("src/backend/InvenTree")
    all_models = {}
    
    # Locate all models.py files
    models_files = sorted(list(base_dir.glob("**/models.py")))
    
    for filepath in models_files:
        relative_path = filepath.relative_to(base_dir.parent.parent).as_posix()
        app_name = filepath.parent.name
        print(f"Parsing {relative_path}...")
        models = parse_model_file(filepath)
        if models:
            all_models[relative_path] = {
                "app": app_name,
                "models": models
            }
            
    # Output to JSON
    output_json = Path("remodeling/schema.json")
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(all_models, f, indent=2)
    print(f"Saved schema JSON to {output_json}")
    
    # Output to Markdown
    output_md = Path("remodeling/schema.md")
    with open(output_md, 'w', encoding='utf-8') as f:
        f.write("# InvenTree Database Schema (Statically Extracted)\n\n")
        f.write("This document lists the database models, their fields, descriptions, and relations extracted from the Django codebase.\n\n")
        
        for filepath, data in all_models.items():
            f.write(f"## App: `{data['app']}` ({filepath})\n\n")
            
            for model in data["models"]:
                db_table = model["meta"].get("db_table", f"\"{data['app']}_{model['name'].lower()}\" (default)")
                f.write(f"### Model: `{model['name']}`\n\n")
                if model["docstring"]:
                    f.write(f"**Description:** {model['docstring']}\n\n")
                f.write(f"**Bases:** {', '.join(model['bases']) if model['bases'] else 'None'}\n\n")
                f.write(f"**Database Table:** {db_table}\n\n")
                
                f.write("| Field Name | Field Type | Null / Blank | Default | Relates To | Description |\n")
                f.write("| --- | --- | --- | --- | --- | --- |\n")
                for field in model["fields"]:
                    rel = f"`{field['relation_to']}`" if field['relation_to'] else ""
                    null_blank = f"{field['null']} / {field['blank']}"
                    desc = field["help_text"] or ""
                    f.write(f"| `{field['name']}` | `{field['type']}` | {null_blank} | `{field['default']}` | {rel} | {desc} |\n")
                f.write("\n")
                
    print(f"Saved schema Markdown to {output_md}")

if __name__ == "__main__":
    main()
