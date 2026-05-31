import { RoomMeshGridSurface } from './RoomMeshGridSurface.js'

/** 霓虹盒五面线框地形（地板 + 四面墙 + 天花，正面开口） */
export class RoomMeshGrid {
  constructor(parent, room, config, meshSegments, meshParams) {
    this.surfaces = []
    const p = meshParams
    const { roomW: w, roomH: h, roomD: d, backZ } = room
    const inset = 0.03
    const common = { config, meshSegments, ...p }

    const mk = (opts) => {
      this.surfaces.push(new RoomMeshGridSurface(parent, { ...common, ...opts }))
    }

    mk({
      width: w,
      height: d,
      position: [0, inset, -d / 2],
      rotation: [-Math.PI / 2, 0, 0],
      renderOrder: 3
    })

    mk({
      width: w,
      height: h,
      position: [0, h / 2, backZ + inset],
      rotation: [0, 0, 0],
      phaseOffset: 0.4,
      renderOrder: 4
    })

    mk({
      width: d,
      height: h,
      position: [-w / 2 + inset, h / 2, -d / 2],
      rotation: [0, Math.PI / 2, 0],
      phaseOffset: 1.2,
      renderOrder: 5
    })

    mk({
      width: d,
      height: h,
      position: [w / 2 - inset, h / 2, -d / 2],
      rotation: [0, -Math.PI / 2, 0],
      phaseOffset: 2.0,
      renderOrder: 5
    })

    mk({
      width: w,
      height: d,
      position: [0, h - inset, -d / 2],
      rotation: [Math.PI / 2, 0, 0],
      phaseOffset: 2.8,
      renderOrder: 6
    })
  }

  update(spectrum, frame, getMappedValue, beatFlash, time, dt) {
    for (const s of this.surfaces) {
      if (spectrum?.length) {
        s.update(spectrum, beatFlash, time, dt)
      } else {
        s.updateIdle(time, beatFlash)
      }
    }
  }

  updateIdle(time, beatFlash = 0) {
    for (const s of this.surfaces) {
      s.updateIdle(time, beatFlash)
    }
  }

  dispose() {
    for (const s of this.surfaces) {
      s.dispose()
    }
    this.surfaces = []
  }
}
