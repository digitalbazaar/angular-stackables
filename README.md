angular-stackables
==================

AngularJS stackable widgets (modals, popovers, menus) that use HTML5 dialog

# Examples

```html
<div stackable="isOpen"
  stackable-modal="true"
  stackable-disable-escape="false"
  stackable-closing="modalClosing(err, result)"
  stackable-closed="modalClosed(err, result)">
  <div class="stackable-dialog">
    <p>Test Dialog</p>
  </div>
</div>
```

```js
function TestController() {
  this.isOpen = false;

  this.modalClosing = function(err, result) {
    /* return false or a Promise that resolves to false to prevent close */
    return true;
  };

  this.modalClosed = function(err, result) {
    console.log('modal closed', err, result);
  };
}
```
