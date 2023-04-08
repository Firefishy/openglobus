import { ray, Ray } from '../../src/og/math/Ray';
import { Vec3 } from '../../src/og/math/Vec3';

describe('Ray class', () => {
    test('methods', () => {
        const item = new Ray();
        expect(Ray.OUTSIDE).toBe(0);
        expect(Ray.INSIDE).toBe(1);
        expect(Ray.INPLANE).toBe(2);
        expect(Ray.AWAY).toBe(3);
        expect(item.set(new Vec3(), new Vec3())).toBeTruthy();
        expect(item.getPoint(1000)).toBeTruthy();
        expect(item.hitTriangle(new Vec3(), new Vec3(), new Vec3(), new Vec3(), 1000)).toBeTruthy();
        expect(item.hitPlane(new Vec3(), new Vec3(), new Vec3(), new Vec3())).toBe(0);
        // expect(item.hitPlane(new Sphere(1, new Vec3()))).toBeTruthy();
        expect(ray()).toBeTruthy();
    });

    test('intersection', () => {
        let ray = new Ray();
        let res = new Vec3();

        let v0 = new Vec3(0, 0, 0),
            v1 = new Vec3(1, 0, 0),
            v2 = new Vec3(0, 0, 1);
        let orig = new Vec3(0.2, -1, 0.2),
            dir = new Vec3(0, -1, 0);
        ray.set(orig, dir.normalize());
        let t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.AWAY);

        orig = new Vec3(0.2, 1, 0.2);
        dir = new Vec3(0, -1, 0);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.INSIDE);

        orig = new Vec3(0, 1, 0);
        dir = new Vec3(0, -1, 0);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.INSIDE);

        orig = new Vec3(0, 1, 0);
        dir = new Vec3(-0.0000001, -1, 0);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.OUTSIDE);

        orig = new Vec3(0, 1, 0);
        dir = new Vec3(0, -1, -0.0000001);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.OUTSIDE);

        orig = new Vec3(0.1, -1, 0.1);
        dir = new Vec3(-1, -1, -1);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.AWAY);

        orig = new Vec3(0.1, -1, 0.1);
        dir = new Vec3(1, -1, 1);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.AWAY);

        orig = new Vec3(0.1, -1, 0.1);
        dir = new Vec3(1, -0.000001, 1);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.AWAY);

        orig = new Vec3(0.1, 1, 0.1);
        dir = new Vec3(1, 0.000001, 1);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.AWAY);

        orig = new Vec3(0.1, 1, 0.1);
        dir = new Vec3(1, -0.000001, 1);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.OUTSIDE);

        orig = new Vec3(0.1, 0.1, 0.1);
        dir = new Vec3(0.1, -0.1, 0.1);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.INSIDE);

        orig = new Vec3(0.1, 0.1, 0.1);
        dir = new Vec3(0, -1, 0);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.INSIDE);
        expect(res).toStrictEqual(new Vec3(0.1, 0, 0.1));

        //parallel
        orig = new Vec3(0.1, 1, 0.1);
        dir = new Vec3(1, 0, 1);
        ray.set(orig, dir.normalize());
        t = ray.hitTriangle(v0, v1, v2, res);
        expect(t).toBe(Ray.OUTSIDE);

    });
});
