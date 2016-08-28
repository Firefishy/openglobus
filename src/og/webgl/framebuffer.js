goog.provide('og.webgl.Framebuffer');

goog.require('og.webgl');
goog.require('og.ImageCanvas');

/**
 * Class represents framebuffer.
 * @class
 * @param {og.webgl.Handler} handler - WebGL handler.
 * @param {number} [width] - Framebuffer width. Default is handler canvas width.
 * @param {number} [height] - Framebuffer height. Default is handler canvas height.
 */
og.webgl.Framebuffer = function (handler, width, height, options) {
    options = options || {};

    /**
     * WebGL handler.
     * @public
     * @type {og.webgl.Handler}
     */
    this.handler = handler;

    /**
     * Framebuffer object.
     * @private
     * @type {Object}
     */
    this._fbo = null;

    /**
     * Renderbuffer object.
     * @private
     * @type {Object}
     */
    this._rbo = null;

    /**
     * Framebuffer width.
     * @private
     * @type {number}
     */
    this._width = width || handler.canvas.width;

    /**
     * Framebuffer width.
     * @private
     * @type {number}
     */
    this._height = height || handler.canvas.height;

    this._useDepth = options.useDepth != undefined ? options.useDepth : true;

    /**
     * Framebuffer texture.
     * @public
     * @type {number}
     */
    this.texture = options.texture || null;

    this._init();
};

og.webgl.Framebuffer.prototype.destroy = function () {
    var gl = this.handler.gl;
    gl.deleteTexture(this.texture);
    gl.deleteFramebuffer(this._fbo);
    gl.deleteRenderbuffer(this._rbo);

    this.texture = null;
    this._rbo = null;
    this._fbo = null;
}

/**
 * Framebuffer initialization.
 * @private
 */
og.webgl.Framebuffer.prototype._init = function () {
    var gl = this.handler.gl;

    this._fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    !this.texture && this.bindTexture(this.handler.createEmptyTexture_n(this._width, this._height));

    if (this._useDepth) {
        this._rbo = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this._rbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this._width, this._height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._rbo);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

/**
 * 
 * @public
 */
og.webgl.Framebuffer.prototype.bindTexture = function (texture) {
    var gl = this.handler.gl;
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
};

/**
 * Sets framebuffer size. Must be before the activate method.
 * @public
 * @param {number} width - Framebuffer width.
 * @param {number} height - Framebuffer height.
 */
og.webgl.Framebuffer.prototype.setSize = function (width, height) {
    this._width = width;
    this._height = height;
    if (this._useDepth) {
        this.destroy();
        this._init();
    }
};

/**
 * Returns framebuffer completed.
 * @public
 * @returns {boolean}
 */
og.webgl.Framebuffer.prototype.isComplete = function () {
    var gl = this.handler.gl;
    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status == gl.FRAMEBUFFER_COMPLETE)
        return true;
    return false;
};

/**
 * Reads all pixels(RGBA colors) from framebuffer.
 * @public
 * @returns {Array.<number>}
 */
og.webgl.Framebuffer.prototype.readAllPixels = function () {
    var res;
    var gl = this.handler.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    //if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    var pixelValues = new Uint8Array(4 * this._width * this._height);
    gl.readPixels(0, 0, this._width, this._height, gl.RGBA, gl.UNSIGNED_BYTE, pixelValues);
    res = pixelValues;
    //}
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return res;
};

/**
 * Gets pixel RBGA color from framebuffer by coordinates.
 * @public
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @returns {Array.<number,number,number,number>}
 */
og.webgl.Framebuffer.prototype.readPixel = function (nx, ny) {
    var res;
    var gl = this.handler.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    //if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    var pixelValues = new Uint8Array(4);
    gl.readPixels(nx * this._width, ny * this._height, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelValues);
    res = pixelValues;
    //}
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return res;
};

/**
 * Activate framebuffer frame to draw.
 * @public
 */
og.webgl.Framebuffer.prototype.activate = function () {
    var h = this.handler,
        gl = h.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    gl.viewport(0, 0, this._width, this._height);
};

/**
 * Deactivate framebuffer frame.
 * @public
 */
og.webgl.Framebuffer.prototype.deactivate = function () {
    var h = this.handler,
        gl = h.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, h.canvas.width, h.canvas.height);
};

/**
 * Gets JavaScript image object that framebuffer has drawn.
 * @public
 * @returns {Object}
 */
og.webgl.Framebuffer.prototype.getImage = function () {
    var data = this.readAllPixels();
    var imageCanvas = new og.ImageCanvas(this._width, this._height);
    imageCanvas.setData(data);
    return imageCanvas.getImage();
};

/**
 * Open dialog window with framebuffer image.
 * @public
 */
og.webgl.Framebuffer.prototype.openImage = function () {
    var img = this.getImage();
    var dataUrl = img.src;
    var windowContent = '<!DOCTYPE html>';
    windowContent += '<html>'
    windowContent += '<head><title>Print</title></head>';
    windowContent += '<body>'
    windowContent += '<img src="' + dataUrl + '">';
    windowContent += '</body>';
    windowContent += '</html>';
    var printWin = window.open('', '', 'width=' + img.width + 'px ,height=' + img.height + 'px');
    printWin.document.open();
    printWin.document.write(windowContent);
    printWin.document.close();
    printWin.focus();
};