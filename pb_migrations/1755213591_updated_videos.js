/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_515447164")

  // update field
  collection.fields.addAt(6, new Field({
    "exceptDomains": [],
    "hidden": false,
    "id": "url250577066",
    "name": "video_url",
    "onlyDomains": [],
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_515447164")

  // update field
  collection.fields.addAt(6, new Field({
    "exceptDomains": [],
    "hidden": false,
    "id": "url250577066",
    "name": "video_url",
    "onlyDomains": [],
    "presentable": false,
    "required": true,
    "system": false,
    "type": "url"
  }))

  return app.save(collection)
})
