"use strict";

exports.__esModule = true;
exports.default = _default;

var _pluginSyntaxDecorators = _interopRequireDefault(require("@babel/plugin-syntax-decorators"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var buildClassDecorator = (0, _core.template)("\n  DECORATOR(CLASS_REF = INNER) || CLASS_REF;\n");
var buildClassPrototype = (0, _core.template)("\n  CLASS_REF.prototype;\n");
var buildGetDescriptor = (0, _core.template)("\n    Object.getOwnPropertyDescriptor(TARGET, PROPERTY);\n");
var buildGetObjectInitializer = (0, _core.template)("\n    (TEMP = Object.getOwnPropertyDescriptor(TARGET, PROPERTY), (TEMP = TEMP ? TEMP.value : undefined), {\n        enumerable: true,\n        configurable: true,\n        writable: true,\n        initializer: function(){\n            return TEMP;\n        }\n    })\n");

function _default() {
  var WARNING_CALLS = new WeakSet();

  function applyEnsureOrdering(path) {
    var decorators = (path.isClass() ? [path].concat(path.get("body.body")) : path.get("properties")).reduce(function (acc, prop) {
      return acc.concat(prop.node.decorators || []);
    }, []);
    var identDecorators = decorators.filter(function (decorator) {
      return !_core.types.isIdentifier(decorator.expression);
    });
    if (identDecorators.length === 0) return;
    return _core.types.sequenceExpression(identDecorators.map(function (decorator) {
      var expression = decorator.expression;
      var id = decorator.expression = path.scope.generateDeclaredUidIdentifier("dec");
      return _core.types.assignmentExpression("=", id, expression);
    }).concat([path.node]));
  }

  function applyClassDecorators(classPath) {
    var decorators = classPath.node.decorators || [];
    classPath.node.decorators = null;
    if (decorators.length === 0) return;
    var name = classPath.scope.generateDeclaredUidIdentifier("class");
    return decorators.map(function (dec) {
      return dec.expression;
    }).reverse().reduce(function (acc, decorator) {
      return buildClassDecorator({
        CLASS_REF: name,
        DECORATOR: decorator,
        INNER: acc
      }).expression;
    }, classPath.node);
  }

  function applyMethodDecorators(path, state) {
    var hasMethodDecorators = path.node.body.body.some(function (node) {
      return (node.decorators || []).length > 0;
    });
    if (!hasMethodDecorators) return;
    return applyTargetDecorators(path, state, path.node.body.body);
  }

  function applyObjectDecorators(path, state) {
    var hasMethodDecorators = path.node.properties.some(function (node) {
      return (node.decorators || []).length > 0;
    });
    if (!hasMethodDecorators) return;
    return applyTargetDecorators(path, state, path.node.properties);
  }

  function applyTargetDecorators(path, state, decoratedProps) {
    var name = path.scope.generateDeclaredUidIdentifier(path.isClass() ? "class" : "obj");
    var exprs = decoratedProps.reduce(function (acc, node) {
      var decorators = node.decorators || [];
      node.decorators = null;
      if (decorators.length === 0) return acc;

      if (node.computed) {
        throw path.buildCodeFrameError("Computed method/property decorators are not yet supported.");
      }

      var property = _core.types.isLiteral(node.key) ? node.key : _core.types.stringLiteral(node.key.name);
      var target = path.isClass() && !node.static ? buildClassPrototype({
        CLASS_REF: name
      }).expression : name;

      if (_core.types.isClassProperty(node, {
        static: false
      })) {
        var descriptor = path.scope.generateDeclaredUidIdentifier("descriptor");
        var initializer = node.value ? _core.types.functionExpression(null, [], _core.types.blockStatement([_core.types.returnStatement(node.value)])) : _core.types.nullLiteral();
        node.value = _core.types.callExpression(state.addHelper("initializerWarningHelper"), [descriptor, _core.types.thisExpression()]);
        WARNING_CALLS.add(node.value);
        acc = acc.concat([_core.types.assignmentExpression("=", descriptor, _core.types.callExpression(state.addHelper("applyDecoratedDescriptor"), [target, property, _core.types.arrayExpression(decorators.map(function (dec) {
          return dec.expression;
        })), _core.types.objectExpression([_core.types.objectProperty(_core.types.identifier("enumerable"), _core.types.booleanLiteral(true)), _core.types.objectProperty(_core.types.identifier("initializer"), initializer)])]))]);
      } else {
        acc = acc.concat(_core.types.callExpression(state.addHelper("applyDecoratedDescriptor"), [target, property, _core.types.arrayExpression(decorators.map(function (dec) {
          return dec.expression;
        })), _core.types.isObjectProperty(node) || _core.types.isClassProperty(node, {
          static: true
        }) ? buildGetObjectInitializer({
          TEMP: path.scope.generateDeclaredUidIdentifier("init"),
          TARGET: target,
          PROPERTY: property
        }).expression : buildGetDescriptor({
          TARGET: target,
          PROPERTY: property
        }).expression, target]));
      }

      return acc;
    }, []);
    return _core.types.sequenceExpression([_core.types.assignmentExpression("=", name, path.node), _core.types.sequenceExpression(exprs), name]);
  }

  return {
    inherits: _pluginSyntaxDecorators.default,
    visitor: {
      ExportDefaultDeclaration: function ExportDefaultDeclaration(path) {
        if (!path.get("declaration").isClassDeclaration()) return;
        var node = path.node;
        var ref = node.declaration.id || path.scope.generateUidIdentifier("default");
        node.declaration.id = ref;
        path.replaceWith(node.declaration);
        path.insertAfter(_core.types.exportNamedDeclaration(null, [_core.types.exportSpecifier(ref, _core.types.identifier("default"))]));
      },
      ClassDeclaration: function ClassDeclaration(path) {
        var node = path.node;
        var ref = node.id || path.scope.generateUidIdentifier("class");
        path.replaceWith(_core.types.variableDeclaration("let", [_core.types.variableDeclarator(ref, _core.types.toExpression(node))]));
      },
      ClassExpression: function ClassExpression(path, state) {
        var decoratedClass = applyEnsureOrdering(path) || applyClassDecorators(path, state) || applyMethodDecorators(path, state);
        if (decoratedClass) path.replaceWith(decoratedClass);
      },
      ObjectExpression: function ObjectExpression(path, state) {
        var decoratedObject = applyEnsureOrdering(path) || applyObjectDecorators(path, state);
        if (decoratedObject) path.replaceWith(decoratedObject);
      },
      AssignmentExpression: function AssignmentExpression(path, state) {
        if (!WARNING_CALLS.has(path.node.right)) return;
        path.replaceWith(_core.types.callExpression(state.addHelper("initializerDefineProperty"), [path.get("left.object").node, _core.types.stringLiteral(path.get("left.property").node.name), path.get("right.arguments")[0].node, path.get("right.arguments")[1].node]));
      }
    }
  };
}