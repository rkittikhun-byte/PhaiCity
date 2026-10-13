# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Builds the Blender library of one art export run (docs/3d/ART_ARCHIVE.md).

Run through `npm run art:blend`, or by hand:
    blender -b --factory-startup --python-exit-code 1 -P scripts/blender/build_library.py -- <run folder>

Every model in the run's manifest.json is imported into its own collection, marked as an asset with a catalog per
category (Blender's Asset Browser), and laid out in rows, one row a category, ten metres to a map tile. Textures the
models share are loaded once and packed, so phaicity-models.blend stands alone; materials that came from the same
game material are merged into one, so changing it changes every model that uses it.
"""

import json
import os
import re
import sys
import uuid

import bpy

TILE_M = 10.0
GAP_M = 6.0
CATALOG_NAMESPACE = uuid.UUID("5a1f0c3e-6b0e-4c55-9a8e-70686169c171")


def run_folder():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not args:
        raise SystemExit("usage: blender -b -P build_library.py -- <run folder>")
    return os.path.abspath(args[0])


def catalog_id(path):
    return str(uuid.uuid5(CATALOG_NAMESPACE, path))


def write_catalogs(folder, categories):
    lines = [
        "# This is an Asset Catalog Definition file for Blender.",
        "#",
        "# Empty lines and lines starting with `#` will be ignored.",
        "# The first non-ignored line should be the version indicator.",
        '# Other lines are of the format "UUID:catalog/path/for/assets:simple catalog name"',
        "",
        "VERSION 1",
        "",
        "%s:PhaiCity:PhaiCity" % catalog_id("PhaiCity"),
    ]
    for category in sorted(categories):
        path = "PhaiCity/%s" % category
        lines.append("%s:%s:PhaiCity-%s" % (catalog_id(path), path, category))
    with open(os.path.join(folder, "blender_assets.cats.txt"), "w", encoding="utf-8", newline="\n") as file:
        file.write("\n".join(lines) + "\n")


def import_model(path):
    """Imports one glTF file and returns the objects it made."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [obj for obj in bpy.data.objects if obj not in before]


def layer_collection(collection, layer=None):
    """The view layer's entry for a collection."""
    layer = layer or bpy.context.view_layer.layer_collection
    if layer.collection == collection:
        return layer
    for child in layer.children:
        found = layer_collection(collection, child)
        if found:
            return found
    return None


def merge_images():
    """One image for each texture file: every model points at the same files."""
    first = {}
    for image in list(bpy.data.images):
        if not image.filepath:
            continue  # drawn in code (signs, water) and stored inside the file: unique
        key = os.path.normcase(os.path.abspath(bpy.path.abspath(image.filepath)))
        if key in first:
            image.user_remap(first[key])
        else:
            first[key] = image


def material_signature(material):
    """What makes two materials the same: the game material's name and what the importer built from it."""
    base = re.sub(r"\.\d{3}$", "", material.name)
    images = []
    values = []
    if material.node_tree:
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                images.append(node.image.name)
            if node.type == "BSDF_PRINCIPLED":
                for socket in node.inputs:
                    value = getattr(socket, "default_value", None)
                    if isinstance(value, float):
                        values.append(round(value, 4))
                    elif value is not None and hasattr(value, "__len__") and len(value) in (3, 4):
                        values.extend(round(v, 4) for v in value)
    return (base, tuple(sorted(images)), tuple(values), material.blend_method if hasattr(material, "blend_method") else "")


def merge_materials():
    first = {}
    for material in list(bpy.data.materials):
        if material.name.startswith("Material"):
            continue  # unnamed in the game: nothing says two of them are one
        key = material_signature(material)
        if key in first:
            material.user_remap(first[key])
        else:
            first[key] = material


def main():
    folder = run_folder()
    with open(os.path.join(folder, "manifest.json"), encoding="utf-8") as file:
        manifest = json.load(file)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    library = bpy.data.collections.new("PhaiCity")
    scene.collection.children.link(library)

    categories = {}
    row_y = 0.0
    row_depth = {}
    cursor = {}
    failures = []
    models = manifest["models"]
    for index, model in enumerate(models):
        category = model["category"]
        if category not in categories:
            collection = bpy.data.collections.new(category)
            library.children.link(collection)
            categories[category] = collection
            cursor[category] = 0.0
            row_depth[category] = 0.0
        try:
            objects = import_model(os.path.join(folder, model["file"]))
        except Exception as error:  # a broken file must not stop the rest
            failures.append((model["file"], str(error)))
            continue
        collection = bpy.data.collections.new(model["name"])
        categories[category].children.link(collection)
        for obj in objects:
            for owner in list(obj.users_collection):
                owner.objects.unlink(obj)
            collection.objects.link(obj)
        # Every import updates the whole view layer, so the models already in are left out of it until the end
        done = layer_collection(collection)
        if done:
            done.exclude = True
        width = model["footprint"][0] * TILE_M
        depth = model["footprint"][1] * TILE_M
        for obj in objects:
            if obj.parent is None or obj.parent not in objects:
                obj.location.x += cursor[category] + width / 2
        cursor[category] += width + GAP_M
        row_depth[category] = max(row_depth[category], depth)

        collection.asset_mark()
        data = collection.asset_data
        data.catalog_id = catalog_id("PhaiCity/%s" % category)
        data.description = "%s · %s · %d triangles" % (model["id"], model.get("regionTier", ""), model.get("triangles", 0))
        for tag in (model.get("region"), model.get("regionTier"), category):
            if tag:
                data.tags.new(tag, skip_if_exists=True)
        if (index + 1) % 50 == 0:
            print("PhaiCity: %d of %d models" % (index + 1, len(models)), flush=True)

    for collection in categories.values():
        for child in collection.children:
            entry = layer_collection(child)
            if entry:
                entry.exclude = False

    # Rows: one category after another along -Y (towards the viewer in Blender's front view)
    for category, collection in categories.items():
        for obj in collection.all_objects:
            if obj.parent is None:
                obj.location.y -= row_y
        row_y += row_depth[category] + 4 * GAP_M

    merge_images()
    merge_materials()
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.file.pack_all()
    write_catalogs(folder, categories)
    target = os.path.join(folder, "phaicity-models.blend")
    bpy.ops.wm.save_as_mainfile(filepath=target, compress=True)
    print("PhaiCity: %d models in %s" % (len(models) - len(failures), target), flush=True)
    for file, error in failures:
        print("PhaiCity: could not import %s: %s" % (file, error), flush=True)
    if failures and len(failures) == len(models):
        raise SystemExit(1)


main()
