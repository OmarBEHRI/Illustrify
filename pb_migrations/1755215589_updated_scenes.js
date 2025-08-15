/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1254289504")

  // remove field
  collection.fields.removeById("url2895943165")

  // remove field
  collection.fields.removeById("url2593671949")

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2895943165",
    "max": 0,
    "min": 0,
    "name": "image_url",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2593671949",
    "max": 0,
    "min": 0,
    "name": "audio_url",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1254289504")

  // add field
  collection.fields.addAt(5, new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "url2895943165",
    "name": "image_url",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "url2593671949",
    "name": "audio_url",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url"
  }))

  // remove field
  collection.fields.removeById("text2895943165")

  // remove field
  collection.fields.removeById("text2593671949")

  return app.save(collection)
})
