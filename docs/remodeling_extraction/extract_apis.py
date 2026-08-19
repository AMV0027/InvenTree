import os
import ast
import json
from pathlib import Path

def get_node_value(node):
    if isinstance(node, ast.Constant):
        return str(node.value)
    elif isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        return f"{get_node_value(node.value)}.{node.attr}"
    return ""

def parse_url_patterns_in_file(filepath):
    """Parse a file and extract all list assignments (like build_api_urls = [...])"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    try:
        tree = ast.parse(content, filename=filepath)
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
        return {}

    url_lists = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    var_name = target.id
                    if isinstance(node.value, ast.List):
                        url_lists[var_name] = node.value.elts
    return url_lists

def resolve_patterns(elts, registry, current_prefix="", current_app="unknown"):
    """Recursively resolve path elements to generate route lists, tracking app/module context"""
    routes = []
    
    for elt in elts:
        if not isinstance(elt, ast.Call):
            continue
            
        func_name = get_node_value(elt.func)
        if func_name not in ('path', 're_path', 'flagged_path'):
            continue
            
        # Parse route pattern (first arg)
        if len(elt.args) < 1:
            continue
        route_pat = get_node_value(elt.args[0])
        
        # Second arg is the target view/include
        if len(elt.args) < 2:
            continue
        target_node = elt.args[1]
        
        # Check name keyword argument
        route_name = ""
        for kw in elt.keywords:
            if kw.arg == "name":
                route_name = get_node_value(kw.value)
                
        # Resolve target
        target_str = ""
        is_include = False
        included_elts = []
        next_app = current_app
        
        if isinstance(target_node, ast.Call):
            target_func = get_node_value(target_node.func)
            if target_func == 'include':
                is_include = True
                inc_arg = target_node.args[0]
                if isinstance(inc_arg, ast.List):
                    included_elts = inc_arg.elts
                elif isinstance(inc_arg, ast.Name):
                    # Refer to a local variable in the same file or registry
                    lookup_val = registry.get(inc_arg.id)
                    if lookup_val:
                        included_elts, next_app = lookup_val
                elif isinstance(inc_arg, ast.Attribute):
                    # Refer to an imported url pattern list, e.g. common.api.admin_api_urls
                    attr_path = get_node_value(inc_arg)
                    lookup_val = registry.get(attr_path)
                    if lookup_val:
                        included_elts, next_app = lookup_val
                elif isinstance(inc_arg, ast.Tuple) and inc_arg.elts:
                    is_include = False
                    target_str = "allauth headless client"
            elif target_func.endswith('.as_view'):
                target_str = target_func[:-8]
            else:
                target_str = get_node_value(target_node)
        elif isinstance(target_node, ast.Attribute):
            target_str = get_node_value(target_node)
        elif isinstance(target_node, ast.Name):
            target_str = target_node.id

        full_route = (current_prefix + route_pat).replace("//", "/")
        
        if is_include:
            if included_elts:
                routes.extend(resolve_patterns(included_elts, registry, full_route, next_app))
            else:
                routes.append({
                    "route": full_route,
                    "target": f"include({get_node_value(target_node.args[0]) if target_node.args else ''})",
                    "name": route_name,
                    "module": next_app
                })
        else:
            routes.append({
                "route": full_route,
                "target": target_str,
                "name": route_name,
                "module": current_app
            })
            
    return routes

def main():
    base_dir = Path("src/backend/InvenTree")
    
    # Locate all api.py and urls.py files
    files = list(base_dir.glob("**/api.py")) + list(base_dir.glob("**/urls.py"))
    
    # Mapping of variable identifier -> (AST elements list, module_name)
    registry = {}
    
    for filepath in files:
        # Determine module/app name
        rel_path = filepath.relative_to(base_dir).as_posix()
        parts = rel_path.replace(".py", "").split("/")
        app_name = parts[0] # e.g. "build", "common", "InvenTree"
        module_path = ".".join(parts) # e.g. "build.api"
        
        url_lists = parse_url_patterns_in_file(filepath)
        for var_name, elts in url_lists.items():
            registry[f"{module_path}.{var_name}"] = (elts, app_name)
            registry[var_name] = (elts, app_name)  # fallback

    # apipatterns in InvenTree/urls.py
    apipatterns_val = registry.get("InvenTree.urls.apipatterns")
    apipatterns_elts = apipatterns_val[0] if apipatterns_val else []
    
    # Resolve all patterns recursively
    api_routes = resolve_patterns(apipatterns_elts, registry, current_prefix="/api/", current_app="InvenTree")
    
    # Resolve standard urlpatterns in InvenTree/urls.py
    urlpatterns_val = registry.get("InvenTree.urls.urlpatterns") or registry.get("urlpatterns")
    urlpatterns_elts = urlpatterns_val[0] if urlpatterns_val else []
    
    other_routes = resolve_patterns(urlpatterns_elts, registry, current_prefix="/", current_app="InvenTree")
    
    # Categorise API routes under their respective modules
    api_by_module = {}
    for route in api_routes:
        mod = route["module"]
        if mod not in api_by_module:
            api_by_module[mod] = []
        api_by_module[mod].append({
            "route": route["route"],
            "target": route["target"],
            "name": route["name"]
        })
        
    other_by_module = {}
    for route in other_routes:
        # Skip apipatterns inclusion
        if "apipatterns" in route['target']:
            continue
        mod = route["module"]
        if mod not in other_by_module:
            other_by_module[mod] = []
        other_by_module[mod].append({
            "route": route["route"],
            "target": route["target"],
            "name": route["name"]
        })

    structured_data = {
        "api_endpoints_by_module": api_by_module,
        "other_endpoints_by_module": other_by_module
    }
    
    # Save to JSON
    output_json = Path("remodeling/apis.json")
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(structured_data, f, indent=2)
    print(f"Saved API schema JSON to {output_json}")
    
    # Save to Markdown
    output_md = Path("remodeling/apis.md")
    with open(output_md, 'w', encoding='utf-8') as f:
        f.write("# InvenTree API Endpoints (Categorised by Modules)\n\n")
        f.write("This document lists the REST API endpoints grouped by their respective codebase modules.\n\n")
        
        f.write("## API Endpoints (`/api/*`)\n\n")
        for module, routes in sorted(api_by_module.items()):
            f.write(f"### Module: `{module}`\n\n")
            f.write("| HTTP Endpoint | View Class / Target | URL Name |\n")
            f.write("| --- | --- | --- |\n")
            for route in routes:
                f.write(f"| `{route['route']}` | `{route['target']}` | `{route['name']}` |\n")
            f.write("\n")
            
        f.write("## General / Web Endpoints\n\n")
        for module, routes in sorted(other_by_module.items()):
            f.write(f"### Module: `{module}`\n\n")
            f.write("| Endpoint Pattern | Target | URL Name |\n")
            f.write("| --- | --- | --- |\n")
            for route in routes:
                f.write(f"| `{route['route']}` | `{route['target']}` | `{route['name']}` |\n")
            f.write("\n")
            
    print(f"Saved API schema Markdown to {output_md}")

if __name__ == "__main__":
    main()
