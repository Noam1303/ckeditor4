const {
  input,
  div,
  text,
  script,
  domReady,
  textarea,
  style,
} = require("@saltcorn/markup/tags");
const { features } = require("@saltcorn/data/db/state");
const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const headers = features?.deep_public_plugin_serve
  ? [
      {
        script: `/plugins/public/ckeditor4${
          features?.version_plugin_serve_path
            ? "@" + require("./package.json").version
            : ""
        }/ckeditor.js`,
      },
    ]
  : [
      {
        script: "https://cdn.ckeditor.com/4.16.0/standard/ckeditor.js",
      },
    ];
const public_user_role = features?.public_user_role || 10;

const CKEditor4 = {
  type: "HTML",
  isEdit: true,
  blockDisplay: true,
  handlesTextStyle: true,
  configFields: async () => {
    const dirs = File.allDirectories ? await File.allDirectories() : null;
    const roles = await User.get_roles();

    return [
      {
        name: "toolbar",
        label: "Toolbar",
        required: true,
        type: "String",
        attributes: { options: ["Standard", "Reduced", "Document"] },
      },
      {
        name: "height",
        label: "Height (em units)",
        type: "Integer",
        default: 10,
      },
      {
        name: "autogrow",
        label: "Auto-grow",
        type: "Bool",
      },
      {
        name: "minheight",
        label: "Min height (px)",
        type: "Integer",
        showIf: { autogrow: true },
      },
      {
        name: "maxheight",
        label: "Max height (px)",
        type: "Integer",
        showIf: { autogrow: true },
      },
      ...(dirs
        ? [
            {
              name: "folder",
              label: "Folder for uploaded media files",
              type: "String",
              attributes: {
                options: [...dirs.map((d) => d.path_to_serve), "Base64 encode"],
              },
            },
          ]
        : []),
      {
        name: "min_role_read",
        label: "Min role read files",
        input_type: "select",
        options: roles.map((r) => ({ value: r.id, label: r.role })),
      },
    ];
  },
  run: (nm, v, attrs, cls) => {
    const toolbarGroups =
      attrs.reduced || attrs.toolbar === "Reduced"
        ? [
            { name: "basicstyles", groups: ["basicstyles", "cleanup"] },
            { name: "links", groups: ["links"] },

            { name: "insert", groups: ["insert"] },
            {
              name: "paragraph",
              groups: [
                "list",
                "indent",
                "blocks",
                "align",
                "bidi",
                "paragraph",
              ],
            },

            { name: "colors", groups: ["colors"] },
            { name: "others", groups: ["others"] },
          ]
        : attrs.toolbar === "Document"
        ? [
            { name: "basicstyles", groups: ["basicstyles", "cleanup"] },

            { name: "clipboard", groups: ["clipboard", "undo"] },
            {
              name: "editing",
              groups: ["find", "selection", "spellchecker", "editing"],
            },

            { name: "insert", groups: ["insert"] },
            {
              name: "paragraph",
              groups: [
                "list",
                "indent",
                "blocks",
                "align",
                "bidi",
                "paragraph",
              ],
            },
            { name: "styles", groups: ["styles"] },
            { name: "colors", groups: ["colors"] },
            { name: "others", groups: ["others"] },
          ]
        : [
            { name: "basicstyles", groups: ["basicstyles", "cleanup"] },
            { name: "links", groups: ["links"] },

            { name: "clipboard", groups: ["clipboard", "undo"] },
            {
              name: "editing",
              groups: ["find", "selection", "spellchecker", "editing"],
            },

            { name: "insert", groups: ["insert"] },
            {
              name: "paragraph",
              groups: [
                "list",
                "indent",
                "blocks",
                "align",
                "bidi",
                "paragraph",
              ],
            },
            { name: "justify", groups: ["justify"] },
            { name: "styles", groups: ["styles"] },
            { name: "font", groups: ["font"] },
            { name: "colors", groups: ["colors"] },
            { name: "others", groups: ["others"] },
          ];
    let varPlugin =
      attrs.folder === "Base64 encode" ? "base64image" : "uploadimage";
    if (attrs.autogrow) varPlugin += ",autogrow";
    const extraPlugins =
      attrs.reduced || attrs.toolbar === "Reduced"
        ? `${varPlugin},dialogadvtab`
        : attrs.toolbar === "Document"
        ? `${varPlugin},colorbutton,font,justify,dialogadvtab,colordialog`
        : `${varPlugin},dialogadvtab`;
    const rndcls = `cke${Math.floor(Math.random() * 16777215).toString(16)}`;

    return div(
      {
        class: [cls],
      },
      textarea(
        {
          name: text(nm),
          id: `input${text(nm)}`,
          rows: 10,
          class: rndcls,
        },
        text(v || "")
      ),
      script(
        domReady(`
var editor = CKEDITOR.replace( $('.${rndcls}')[0], {
  extraPlugins: ${JSON.stringify(extraPlugins)},
  ${attrs.folder === "Base64 encode" ? "" : `imageUploadUrl: '/files/upload',`}
  ${attrs.disabled ? `readOnly: true,` : ``}
  toolbarGroups: ${JSON.stringify(toolbarGroups)},
  ${
    attrs.toolbar === "Document"
      ? `removeButtons: '',`
      : `removeButtons: 'Subscript,Superscript',`
  }
  ${
    attrs.autogrow
      ? `autoGrow_minHeight: ${attrs.minheight},
         autoGrow_maxHeight:${attrs.maxheight},`
      : `height: "${attrs.height || 10}em",`
  }
  disallowedContent: 'img{width,height}',
  extraAllowedContent: 'img[width,height]',
  image_previewText: ' ',
} );
CKEDITOR.on('dialogDefinition', function (ev) {
  var dialogName = ev.data.name;
  var dialogDefinition = ev.data.definition;

  if (dialogName === 'table') {
    var addCssClass = dialogDefinition.getContents('advanced').get('advCSSClasses');
    addCssClass['default'] = 'table-inner-grid';
  }
});
let ckOnChange = ()=>{
  editor.updateElement();
  $('textarea#input${text(nm)}').closest('form').trigger('change');
}
editor.on('change', $.debounce ? $.debounce(ckOnChange, 500, null,true) : ckOnChange);
${
  attrs.folder === "Base64 encode"
    ? ""
    : `editor.on( 'fileUploadRequest', function( evt ) {
  var fileLoader = evt.data.fileLoader,
      formData = new FormData(),
      xhr = fileLoader.xhr;

  xhr.open( 'POST', fileLoader.uploadUrl, true );
  formData.append( 'file', fileLoader.file, fileLoader.fileName );
  formData.append( 'min_role_read',${
    attrs?.min_role_read || public_user_role
  } );
  ${
    attrs.folder
      ? `formData.append( 'folder', ${JSON.stringify(attrs.folder)} );`
      : ""
  }
  xhr.setRequestHeader( 'CSRF-Token', _sc_globalCsrf );
  xhr.setRequestHeader( 'X-Requested-With', 'XMLHttpRequest' );
  fileLoader.xhr.send( formData );

  // Prevented the default behavior.
  evt.stop();
})
editor.on('fileUploadResponse', function( evt ) {
  evt.stop();
  var data = evt.data,
  xhr = data.fileLoader.xhr,
  response = xhr.responseText;
  const r = JSON.parse(response);
  
  evt.data.uploaded=1;
  evt.data.fileName=r.success.filename;
  evt.data.url=r.success.url;
});`
}


$('#input${text(nm)}').on('set_form_field', (e)=>{
  editor.setData(e.target.value)
})
      `)
      )
    );
  },
};

const dependencies = ["@saltcorn/html"];

module.exports = {
  sc_plugin_api_version: 1,
  fieldviews: { CKEditor4 },
  plugin_name: "ckeditor4",
  headers,
  dependencies,
  ready_for_mobile: true,
};
