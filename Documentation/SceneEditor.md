# Using it in SceneEditor

[SceneEditor](https://github.com/VJigouline/SceneEditor) opens `.x3d`, `.x3dv`, `.x3dz` and `.x3dvz` files, with their textures with mc-x3d-import. Drop the `.x3d` file with its textures, or their folder, or a zip.

The model is added to the scene, named after its file, and the view is refitted. A file that can't be read gives a **Failure** message, and the scene is unaffected. Warnings go to the browser console.

It comes in metres with Y up, like the other formats.
