/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation2375276105",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "select2063623452",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "queued",
          "processing",
          "completed",
          "failed"
        ]
      },
      {
        "convertURLs": false,
        "hidden": false,
        "id": "editor73962100",
        "maxSize": 0,
        "name": "story_input",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "editor"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1684111654",
        "max": 0,
        "min": 0,
        "name": "visual_style",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select2092043024",
        "maxSelect": 1,
        "name": "quality",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "LOW",
          "HIGH",
          "MAX"
        ]
      },
      {
        "hidden": false,
        "id": "select3484675102",
        "maxSelect": 1,
        "name": "input_type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "text",
          "pdf",
          "youtube"
        ]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_515447164",
        "hidden": false,
        "id": "relation2093472300",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "video",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text737763667",
        "max": 0,
        "min": 0,
        "name": "error_message",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "json570552902",
        "maxSize": 0,
        "name": "progress",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_2855181806",
    "indexes": [],
    "listRule": null,
    "name": "generation_jobs",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2855181806");

  return app.delete(collection);
})
