'use strict';

import { Vec3 } from "../../math/Vec3.js";
import { Deferred } from "../../Deferred.js";
import { Events } from '../../Events.js';

/**
 * Point types
 * @type {number}
 */
const SAFE = 0;
const WARNING = 1;
const COLLISION = 2;

/**
 * drawData index names
 * @type {number}
 */
const TRACK = 0;
const GROUND = 1;

const SEGMMENT_LENGTH = 1.0; // Distance between query points on the ground
const GROUND_OFFSET = 1.0; // Ground level offset
const BOTTOM_PADDING = 0.1; // Range minY padding in percentage from the bottom
const TOP_PADDING = 0.1; // Range maxY padding in percentage from the top

const HEIGHT_EPS = 0.1; // Warning height level error

class ElevationProfile {
    constructor(options = {}) {
        this.events = new Events(["profilecollected"]);

        this.planet = options.planet;

        this._warningHeightLevel = 50;
        this._pointsReady = false;
        this._isWarning = false;

        this._minX = 0;
        this._maxX = 1000;
        this._minY = 0;
        this._maxY = 200;

        this._drawData = [][0];

        this._promiseArr = [];
        this._promiseCounter = 0;
        this._pMaxY = 0;
        this._pMinY = 0;
        this._pDist = 0;
        this._pTrackCoords = [[0, 0, SAFE]];
        this._pGroundCoords = [[0, 0, SAFE]];
        this._pIndex = 0;
    }

    setWarningHeightLevel(warningHeight = 0) {
        this._warningHeightLevel = warningHeight;
    }

    setRange(minX, maxX, minY, maxY) {
        this._minX = minX;
        this._maxX = maxX;
        this._minY = minY;
        this._maxY = maxY;
    }

    _getHeightAsync(ll, pIndex) {
        let def = new Deferred();
        this.planet.terrain.getHeightAsync(ll, (elv) => {
            elv += this.planet.terrain.geoid.getHeightLonLat(ll);
            this._pGroundCoords[pIndex][1] = elv;
            this._pGroundCoords[pIndex][2] = SAFE;
            this._pGroundCoords[pIndex][3] = ll.height;
            this._setPointType(pIndex);
            def.resolve(elv);
        });
        return def.promise;
    }

    _collectCoordsBetweenTwoTrackPoints(internalPoints, scaleFactor, p0, trackDir) {
        for (let j = 1; j <= internalPoints; j++) {
            this._pDist += SEGMMENT_LENGTH;
            this._pIndex++;

            // Point on the track segment
            let dirSegLen = j * scaleFactor;
            let pjd = p0.add(trackDir.scaleTo(dirSegLen));
            let llx = this.planet.ellipsoid.cartesianToLonLat(pjd);

            this._pGroundCoords[this._pIndex] = [this._pDist, 0, SAFE];

            ((lonlat, index) => {
                this._promiseArr.push(
                    this._getHeightAsync(lonlat, index)
                        .then((elv) => {
                            if (elv > this._pMaxY) this._pMaxY = elv;
                            if (elv < this._pMinY) this._pMinY = elv;
                        })
                );
            })(llx, this._pIndex);
        }
    }

    _collectAllPoints(pointsLonLat) {

        let p0 = new Vec3(),
            p1 = new Vec3();

        for (let i = 1, len = pointsLonLat.length; i < len; i++) {
            let lonlat0 = pointsLonLat[i - 1],
                lonlat1 = pointsLonLat[i];

            this.planet.ellipsoid.lonLatToCartesianRes(lonlat0, p0);
            this.planet.ellipsoid.lonLatToCartesianRes(lonlat1, p1);

            let trackDir = p1.sub(p0);
            let dirLength = trackDir.length();
            let n0 = this.planet.ellipsoid.getSurfaceNormal3v(p0);
            let proj = Vec3.proj_b_to_plane(trackDir, n0);
            let projLen = proj.length();
            let internalPoints = Math.floor(projLen / SEGMMENT_LENGTH);
            let scaleFactor = SEGMMENT_LENGTH * dirLength / projLen;

            this._getGroundElevation(lonlat0);

            proj.normalize();
            trackDir.normalize();

            // Getting internal point elevations and looking for the collisions
            this._collectCoordsBetweenTwoTrackPoints(internalPoints, scaleFactor, p0, trackDir);

            this._pDist += projLen - internalPoints * SEGMMENT_LENGTH;
            this._pIndex++;

            let elv = lonlat1.height;
            if (elv > this._pMaxY) this._pMaxY = elv;
            if (elv < this._pMinY) this._pMinY = elv;

            this._pTrackCoords[i] = [this._pDist, elv];
        }
    }

    _getGroundElevation(lonLat) {
        this._pGroundCoords[this._pIndex] = [this._pDist, 0, SAFE];
        this._promiseArr.push(
            this._getHeightAsync(lonLat, this._pIndex)
                .then((elv) => {
                    if (typeof elv === 'number') {
                        if ((elv > this._pMaxY) && (elv)) this._pMaxY = elv;
                        if ((elv < this._pMinY) && (elv)) this._pMinY = elv;
                    }
                })
        );
    }

    _collectPromise(resolve) {
        Promise.all(this._promiseArr).then(() => {
            resolve({
                dist: this._pDist,
                minY: this._pMinY,
                maxY: this._pMaxY,
                trackCoords: this._pTrackCoords,
                groundCoords: this._pGroundCoords
            });
        });
    }

    _calcPointsAsync(pointsLonLat) {
        return new Promise((resolve, reject) => {
            this._pTrackCoords = [[0, pointsLonLat[0].height]];
            this._pMaxY = pointsLonLat[0].height;
            this._pMinY = this._pMaxY;
            this._pDist = 0;
            this._pGroundCoords = [[0, 0, SAFE]];
            this._pIndex = 0;
            this._promiseArr = [];

            this._collectAllPoints(pointsLonLat);
            this._getGroundElevation(pointsLonLat[pointsLonLat.length - 1]);
            this._collectPromise(resolve);
        });
    }

    get minX() {
        return this._minX;
    }

    get maxX() {
        return this._maxX;
    }

    get minY() {
        return this._minY;
    }

    get maxY() {
        return this._maxY;
    }

    get pointsReady() {
        return this._pointsReady;
    }

    get isWarningOrCollision() {
        return this._isWarning;
    }

    collectProfile(pointsLonLat) {
        this._pointsReady = false;
        this._isWarning = false;

        if (!pointsLonLat || !pointsLonLat.length) return;

        this._promiseCounter++;

        ((counter) => {
            this._calcPointsAsync(pointsLonLat).then((p) => {
                if (counter === this._promiseCounter) {
                    this.setRange(0, p.dist, p.minY - BOTTOM_PADDING * Math.abs(p.minY), p.maxY + Math.abs(p.maxY) * TOP_PADDING);
                    this._pointsReady = true;
                    this._drawData = [p.trackCoords, p.groundCoords];
                    this.events.dispatch(this.events.profilecollected, this._drawData, this);
                }
            });
        })(this._promiseCounter);
    }

    _setPointType(pIndex) {
        if ((this._pGroundCoords[pIndex][3] >= this._pGroundCoords[pIndex][1]) &&
            (this._pGroundCoords[pIndex][3] < this._pGroundCoords[pIndex][1] + this._warningHeightLevel - HEIGHT_EPS)) {
            this._pGroundCoords[pIndex][2] = WARNING;
        }

        if (this._pGroundCoords[pIndex][3] <= this._pGroundCoords[pIndex][1] + GROUND_OFFSET) {
            this._pGroundCoords[pIndex][2] = COLLISION;
        }

        if (this._pGroundCoords[pIndex][2] == WARNING || this._pGroundCoords[pIndex][2] == COLLISION) {
            this._isWarning = true;
        }
    }

    _setPointsType() {
        this._isWarning = false;

        this._pTrackCoords = this._drawData[TRACK];
        this._pGroundCoords = this._drawData[GROUND];

        for (let i = 0; i < this._pGroundCoords.length; i++) {
            this._setPointType(i);
        }

        this._drawData[GROUND] = this._pGroundCoords;
        this.events.dispatch(this.events.profilecollected, this._drawData, this);
    }

    clear() {
        this._pointsReady = false;
        this._isWarning = false;
        this._drawData = [][0];
        this._pMaxY = 0;
        this._pMinY = 0;
        this._pDist = 0;
        this._pTrackCoords = [[0, 0, SAFE]];
        this._pGroundCoords = [[0, 0, SAFE]];
        this._pIndex = 0;
    }
}

export {
    SAFE,
    COLLISION,
    WARNING,
    ElevationProfile
};