  /* ------------------------------------------------------------
     Albers 等积圆锥投影（标准纬线 25°N / 47°N）
     ------------------------------------------------------------ */
  const ALBERS = (() => {
    const p1 = 25 * RAD, p2 = 47 * RAD, p0 = 35 * RAD, l0 = 105 * RAD;
    const n = (Math.sin(p1) + Math.sin(p2)) / 2;
    const Cc = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1);
    const rho0 = Math.sqrt(Cc - 2 * n * Math.sin(p0)) / n;
    return {
      fwd(lon, lat) {
        const th = n * (lon * RAD - l0);
        const rho = Math.sqrt(Math.max(Cc - 2 * n * Math.sin(lat * RAD), 1e-7)) / n;
        return [rho * Math.sin(th), -(rho0 - rho * Math.cos(th))];
      },
      inv(x, y) {
        // y = -(rho0 - rho·cos th) → rho·cos th = rho0 + y
        const d = rho0 + y;
        const th = Math.atan2(x, d);
        const rho = Math.hypot(x, d);
        const sinLat = (Cc - (rho * n) ** 2) / (2 * n);
        const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
        return [(th / n + l0) / RAD, lat / RAD];
      }
    };
  })();
  const albers = (lon, lat) => ALBERS.fwd(lon, lat);

  /* ------------------------------------------------------------
     0.5° 海拔网格（ETOPO1 采样，assets/elev.js）
     ------------------------------------------------------------ */
  const ELEV = window.CN_ELEV || null;
  const ELEV_ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
  function elevRaw(i, j) {
    const o = (j * ELEV.nx + i) * 2;
    const v = ELEV_ALPHA.indexOf(ELEV.data[o]) * 64 + ELEV_ALPHA.indexOf(ELEV.data[o + 1]);
    return (v - 50) * ELEV.unit;
  }
  // 双线性插值：粗网格直接取整点会阶跃，插值后读数更接近连续地形
  function elevAt(lon, lat) {
    if (!ELEV || !ELEV.data) return null;
    const fx = (lon - ELEV.lon0) / ELEV.step, fy = (lat - ELEV.lat0) / ELEV.step;
    if (fx < 0 || fy < 0 || fx > ELEV.nx - 1 || fy > ELEV.ny - 1) return null;
    const i = Math.min(ELEV.nx - 2, Math.floor(fx)), j = Math.min(ELEV.ny - 2, Math.floor(fy));
    const tx = fx - i, ty = fy - j;
    const a = elevRaw(i, j), b = elevRaw(i + 1, j), c = elevRaw(i, j + 1), d = elevRaw(i + 1, j + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

