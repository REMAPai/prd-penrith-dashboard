"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="soft" style={{ height: 480 }}>Loading map...</div> });
export default MapView;
