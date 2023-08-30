import { Sphere } from "../bv/Sphere";
import { LonLat } from "../LonLat";
import { Quat } from "../math/Quat";
import { Ray } from "../math/Ray";
import { Vec3 } from "../math/Vec3";
import { Control } from "./Control";

class Touch {
    x: number;
    y: number;
    prev_x: number;
    prev_y: number;
    grabbedPoint: Vec3;
    grabbedSpheroid: Sphere;
    dX: () => number;
    dY: () => number;
    constructor() {
        this.x = 0;
        this.y = 0;
        this.prev_x = 0;
        this.prev_y = 0;
        this.grabbedPoint = new Vec3();
        this.grabbedSpheroid = new Sphere();
        this.dX = function () {
            return this.x - this.prev_x;
        };
        this.dY = function () {
            return this.y - this.prev_y;
        };
    }
}

export class EarthNavigation extends Control {
    grabbedPoint: Vec3;
    grabbedDir: Vec3;
    inertia: number;
    grabbedSpheroid: Sphere;
    _vRot: Quat;
    _hRot: Quat;
    _a: number;
    scaleRot: number;
    currState: number;
    positionState: { h: number; max: number; min: number; }[];
    touches: Touch[];
    constructor(options = {}) {
        super(options);

        this.grabbedPoint = new Vec3();
        this.grabbedDir = new Vec3();
        this.inertia = 0.007;
        this.grabbedSpheroid = new Sphere();
        this.planet = null;
        this._vRot = new Quat();
        this._hRot = new Quat();
        this._a = 0.0;
        this.scaleRot = 0;
        this.currState = 0;

        this.positionState = [
            { h: 17119745.303455353, max: 0.98, min: -0.98 },
            { h: 6866011, max: 0.98, min: -0.98 },
            { h: 3000000, max: 0.98, min: -0.98 },
            { h: 1000000, max: 0.98, min: -0.98 },
            { h: 500000, max: 0.98, min: -0.98 }
        ];

        this.touches = [new Touch(), new Touch()];
    }

    switchZoomState(wheelDelta: number) {
        this.stopRotation();

        if (wheelDelta > 0) {
            this.currState++;
        } else {
            this.currState--;
        }

        if (this.currState <= 0) this.currState = 0;

        if (this.currState >= this.positionState.length) {
            this.currState = this.positionState.length - 1;
        }

        this.planet!.stopFlying();

        var ll = this.renderer.activeCamera._lonLat;

        this.planet!.flyLonLat(new LonLat(ll.lon, ll.lat, this.positionState[this.currState].h));
    }

    onMouseWheel(event: any) {
        this.switchZoomState(event.wheelDelta);
    }

    override oninit() {
        this.activate();
    }

    override onactivate() {
        this.planet = this.renderer.renderNodes.Earth;

        this.renderer.events.on("mousewheel", this.onMouseWheel, this);
        this.renderer.events.on("lhold", this.onMouseLeftButtonDown, this);
        this.renderer.events.on("ldown", this.onMouseLeftButtonClick, this);
        this.renderer.events.on("lup", this.onMouseLeftButtonUp, this);

        this.renderer.events.on("touchstart", this.onTouchStart, this);
        this.renderer.events.on("touchend", this.onTouchEnd, this);
        this.renderer.events.on("touchmove", this.onTouchMove, this);

        this.renderer.events.on("draw", this.onDraw, this);
    }

    onTouchStart(e: any) {
        if (e.sys.touches.length == 1) {
            const t = this.touches[0] as any;

            t.x = e.sys.touches.item(0).pageX - e.sys.offsetLeft;
            t.y = e.sys.touches.item(0).pageY - e.sys.offsetTop;
            t.prev_x = e.sys.touches.item(0).pageX - e.sys.offsetLeft;
            t.prev_y = e.sys.touches.item(0).pageY - e.sys.offsetTop;

            // t.grabbedPoint = this.planet!.getCartesianFromPixelTerrain(t, true);
            t.grabbedPoint = this.planet!.getCartesianFromPixelTerrain(t);

            if (t.grabbedPoint) {
                t.grabbedSpheroid.radius = t.grabbedPoint.length();
                this.stopRotation();
            }
        }
    }

    onTouchEnd(e: any) {
        if (e.sys.touches.length == 0) {
            this.scaleRot = 1;

            if (
                Math.abs(this.touches[0].x - this.touches[0].prev_x) < 3 &&
                Math.abs(this.touches[0].y - this.touches[0].prev_y) < 3
            )
                this.stopRotation();
        }
    }

    onTouchMove(e: any) {
        if (e.sys.touches.length == 1) {
            var cam = this.renderer.activeCamera;

            var t = this.touches[0];

            t.prev_x = t.x;
            t.prev_y = t.y;
            t.x = e.sys.touches.item(0).pageX - e.sys.offsetLeft;
            t.y = e.sys.touches.item(0).pageY - e.sys.offsetTop;

            if (!t.grabbedPoint) return;

            var direction = cam.unproject(t.x, t.y);
            var targetPoint = new Ray(cam.eye, direction).hitSphere(t.grabbedSpheroid);

            if (targetPoint) {
                this._a =
                    Math.acos(t.grabbedPoint.y / t.grabbedSpheroid.radius) -
                    Math.acos(targetPoint.y / t.grabbedSpheroid.radius);
                this._vRot = Quat.axisAngleToQuat(cam._u, this._a);
                this._hRot = Quat.getRotationBetweenVectors(
                    new Vec3(targetPoint.x, 0.0, targetPoint.z).normal(),
                    new Vec3(t.grabbedPoint.x, 0.0, t.grabbedPoint.z).normal()
                );
                var rot = this._hRot.mul(this._vRot);

                var state = this.positionState[this.currState];
                var lim = rot.mulVec3(cam.eye).normal().dot(Vec3.NORTH);
                if (lim > state.max || lim < state.min) {
                    rot = Quat.yRotation(rot.getYaw());
                }

                cam.set(rot.mulVec3(cam.eye), Vec3.ZERO, Vec3.NORTH);
                cam.update();
            }
        }
    }

    onMouseLeftButtonClick(e: any) {
        this.renderer.handler.gl.canvas.classList.add("ogGrabbingPoiner");
        // this.grabbedPoint = this.planet!.getCartesianFromMouseTerrain(true);
        this.grabbedPoint = this.planet!.getCartesianFromMouseTerrain()!;
        this.grabbedDir.copy(e.direction);
        if (this.grabbedPoint) {
            this.grabbedSpheroid.radius = this.grabbedPoint.length();
            this.stopRotation();
        }
    }

    stopRotation() {
        this.scaleRot = 0.0;
        this._a = 0.0;
        this._vRot.clear();
        this._hRot.clear();
    }

    onMouseLeftButtonUp(e: any) {
        this.scaleRot = 1;
        this.renderer.handler.gl.canvas.classList.remove("ogGrabbingPoiner");

        if (Math.abs(e.x - e.prev_x) < 3 && Math.abs(e.y - e.prev_y) < 3) this.stopRotation();
    }

    onMouseLeftButtonDown(e: any) {
        var cam = this.renderer.activeCamera;

        if (!this.grabbedPoint || cam.isFlying()) return;

        if (this.renderer.events.mouseState.moving) {
            var targetPoint = new Ray(cam.eye, e.direction).hitSphere(this.grabbedSpheroid);

            if (targetPoint) {

                this._a = Math.acos(this.grabbedPoint.y / this.grabbedSpheroid.radius) -
                    Math.acos(targetPoint.y / this.grabbedSpheroid.radius);

                let rot = this._vRot = Quat.axisAngleToQuat(cam._u, this._a);

                cam.set(rot.mulVec3(cam.eye), Vec3.ZERO, rot.mulVec3(cam.getUp()));

                this._hRot = Quat.getRotationBetweenVectors(
                    new Vec3(targetPoint.x, 0.0, targetPoint.z).normal(),
                    new Vec3(this.grabbedPoint.x, 0.0, this.grabbedPoint.z).normal()
                );

                rot = this._hRot;

                cam.set(rot.mulVec3(cam.eye), Vec3.ZERO, rot.mulVec3(cam.getUp()));
                cam.update();
            }
        } else {
            this.scaleRot = 0;
        }
    }

    onDraw(e: any) {
        var r = this.renderer;
        var cam = r.activeCamera;

        if (r.events.mouseState.leftButtonDown || !this.scaleRot || cam.isFlying()) return;

        this.scaleRot -= this.inertia;
        if (this.scaleRot <= 0) {
            this.scaleRot = 0;
        } else {
            this._vRot = Quat.axisAngleToQuat(cam._u, this._a);
            var rot = this._vRot.mul(this._hRot);

            var lim = rot.mulVec3(cam.eye).normal().dot(Vec3.NORTH);

            var state = this.positionState[this.currState];

            if (lim > state.max || lim < state.min) {
                rot = Quat.yRotation(rot.getYaw());
            }

            r.controlsBag.scaleRot = this.scaleRot;
            rot = rot
                .slerp(Quat.IDENTITY, 1 - this.scaleRot * this.scaleRot * this.scaleRot)
                .normalize();
            if (!(rot.x || rot.y || rot.z)) {
                this.scaleRot = 0;
            }

            cam.set(rot.mulVec3(cam.eye), Vec3.ZERO, Vec3.NORTH);
            cam.update();
        }
    }
}