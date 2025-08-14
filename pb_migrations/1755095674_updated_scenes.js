/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1254289504")

  // update collection data
  unmarshal({
    "createRule": "video.user = @request.auth.id",
    "deleteRule": "video.user = @request.auth.id",
    "listRule": "video.user = @request.auth.id",
    "updateRule": "video.user = @request.auth.id",
    "viewRule": "video.user = @request.auth.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1254289504")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
