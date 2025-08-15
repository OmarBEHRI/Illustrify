/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_515447164")

  // remove field
  collection.fields.removeById("url250577066")

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text250577066",
    "max": 0,
    "min": 0,
    "name": "video_url",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_515447164")

  // add field
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

  // remove field
  collection.fields.removeById("text250577066")

  return app.save(collection)
})
