/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { MaterialKey } from './library.js';

export interface TextureAsset {
  file: string;
  identity: string;
  meters: readonly [number, number];
}

export interface TextureDefinition {
  label: string;
  sources: readonly string[];
  maps: Partial<Record<'color' | 'normal' | 'roughness' | 'ao' | 'metalness' | 'alpha', TextureAsset>>;
  pattern?: 'cement' | 'curb' | 'water';
}

/** Source dimensions convert metre-based UVs into physically scaled repeats. */
export const TEXTURE_CATALOG = {
  "plaster_white": {
    "label": "ปูนขาวเก่าคราบฝน",
    "sources": [
      "https://polyhaven.com/a/white_plaster_rough_01"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/plaster_white/color.jpg",
        "identity": "white_plaster_rough_01:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/plaster_white/normal.jpg",
        "identity": "white_plaster_rough_01:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/plaster_white/roughness.jpg",
        "identity": "white_plaster_rough_01:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/plaster_white/ao.jpg",
        "identity": "white_plaster_rough_01:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "plaster_cream": {
    "label": "ปูนครีม",
    "sources": [
      "https://polyhaven.com/a/white_plaster_rough_01"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/plaster_cream/color.jpg",
        "identity": "white_plaster_rough_01:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/plaster_cream/normal.jpg",
        "identity": "white_plaster_rough_01:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/plaster_cream/roughness.jpg",
        "identity": "white_plaster_rough_01:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/plaster_cream/ao.jpg",
        "identity": "white_plaster_rough_01:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "plaster_tint": {
    "label": "ปูนย้อมสี",
    "sources": [
      "https://polyhaven.com/a/white_plaster_rough_01"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/plaster_tint/color.jpg",
        "identity": "white_plaster_rough_01:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/plaster_tint/normal.jpg",
        "identity": "white_plaster_rough_01:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/plaster_tint/roughness.jpg",
        "identity": "white_plaster_rough_01:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/plaster_tint/ao.jpg",
        "identity": "white_plaster_rough_01:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "concrete_raw": {
    "label": "คอนกรีตดิบ",
    "sources": [
      "https://polyhaven.com/a/concrete_wall_006"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/concrete_raw/color.jpg",
        "identity": "concrete_wall_006:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/concrete_raw/normal.jpg",
        "identity": "concrete_wall_006:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/concrete_raw/roughness.jpg",
        "identity": "concrete_wall_006:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/concrete_raw/ao.jpg",
        "identity": "concrete_wall_006:AO",
        "meters": [
          2.0,
          2.0
        ]
      }
    }
  },
  "concrete_weathered": {
    "label": "คอนกรีตเก่า",
    "sources": [
      "https://polyhaven.com/a/concrete_floor_02"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/concrete_weathered/color.jpg",
        "identity": "concrete_floor_02:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/concrete_weathered/normal.jpg",
        "identity": "concrete_floor_02:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/concrete_weathered/roughness.jpg",
        "identity": "concrete_floor_02:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/concrete_weathered/ao.jpg",
        "identity": "concrete_floor_02:AO",
        "meters": [
          2.0,
          2.0
        ]
      }
    }
  },
  "brick_red": {
    "label": "อิฐแดง",
    "sources": [
      "https://polyhaven.com/a/red_brick"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/brick_red/color.jpg",
        "identity": "red_brick:Diffuse",
        "meters": [
          1.399999976158142,
          1.399999976158142
        ]
      },
      "normal": {
        "file": "assets/textures/brick_red/normal.jpg",
        "identity": "red_brick:nor_gl",
        "meters": [
          1.399999976158142,
          1.399999976158142
        ]
      },
      "roughness": {
        "file": "assets/textures/brick_red/roughness.jpg",
        "identity": "red_brick:Rough",
        "meters": [
          1.399999976158142,
          1.399999976158142
        ]
      },
      "ao": {
        "file": "assets/textures/brick_red/ao.jpg",
        "identity": "red_brick:AO",
        "meters": [
          1.399999976158142,
          1.399999976158142
        ]
      }
    }
  },
  "roof_clay_tile": {
    "label": "กระเบื้องดินเผา",
    "sources": [
      "https://polyhaven.com/a/clay_roof_tiles"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/roof_clay_tile/color.jpg",
        "identity": "clay_roof_tiles:Diffuse",
        "meters": [
          4.0,
          4.0
        ]
      },
      "normal": {
        "file": "assets/textures/roof_clay_tile/normal.jpg",
        "identity": "clay_roof_tiles:nor_gl",
        "meters": [
          4.0,
          4.0
        ]
      },
      "roughness": {
        "file": "assets/textures/roof_clay_tile/roughness.jpg",
        "identity": "clay_roof_tiles:Rough",
        "meters": [
          4.0,
          4.0
        ]
      },
      "ao": {
        "file": "assets/textures/roof_clay_tile/ao.jpg",
        "identity": "clay_roof_tiles:AO",
        "meters": [
          4.0,
          4.0
        ]
      }
    }
  },
  "roof_cement_tile": {
    "label": "กระเบื้องลอนคู่ซีเมนต์",
    "sources": [
      "https://polyhaven.com/a/concrete_wall_006",
      "https://polyhaven.com/a/corrugated_iron"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/roof_cement_tile/color.jpg",
        "identity": "concrete_wall_006:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/roof_cement_tile/normal.jpg",
        "identity": "corrugated_iron:nor_gl",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "roughness": {
        "file": "assets/textures/roof_cement_tile/roughness.jpg",
        "identity": "concrete_wall_006:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/roof_cement_tile/ao.jpg",
        "identity": "corrugated_iron:AO",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      }
    },
    "pattern": "cement"
  },
  "roof_metal_corrugated": {
    "label": "สังกะสี",
    "sources": [
      "https://polyhaven.com/a/corrugated_iron"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/roof_metal_corrugated/color.jpg",
        "identity": "corrugated_iron:Diffuse",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "normal": {
        "file": "assets/textures/roof_metal_corrugated/normal.jpg",
        "identity": "corrugated_iron:nor_gl",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "roughness": {
        "file": "assets/textures/roof_metal_corrugated/roughness.jpg",
        "identity": "corrugated_iron:Rough",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "ao": {
        "file": "assets/textures/roof_metal_corrugated/ao.jpg",
        "identity": "corrugated_iron:AO",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "metalness": {
        "file": "assets/textures/roof_metal_corrugated/metalness.jpg",
        "identity": "corrugated_iron:Metal",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      }
    }
  },
  "roof_metal_rusty": {
    "label": "สังกะสีสนิม",
    "sources": [
      "https://polyhaven.com/a/rusty_corrugated_iron"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/roof_metal_rusty/color.jpg",
        "identity": "rusty_corrugated_iron:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/roof_metal_rusty/normal.jpg",
        "identity": "rusty_corrugated_iron:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/roof_metal_rusty/roughness.jpg",
        "identity": "rusty_corrugated_iron:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/roof_metal_rusty/ao.jpg",
        "identity": "rusty_corrugated_iron:AO",
        "meters": [
          2.0,
          2.0
        ]
      }
    }
  },
  "roof_metal_sheet": {
    "label": "เมทัลชีท",
    "sources": [
      "https://polyhaven.com/a/box_profile_metal_sheet"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/roof_metal_sheet/color.jpg",
        "identity": "box_profile_metal_sheet:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/roof_metal_sheet/normal.jpg",
        "identity": "box_profile_metal_sheet:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/roof_metal_sheet/roughness.jpg",
        "identity": "box_profile_metal_sheet:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/roof_metal_sheet/ao.jpg",
        "identity": "box_profile_metal_sheet:AO",
        "meters": [
          2.0,
          2.0
        ]
      },
      "metalness": {
        "file": "assets/textures/roof_metal_sheet/metalness.jpg",
        "identity": "box_profile_metal_sheet:Metal",
        "meters": [
          2.0,
          2.0
        ]
      }
    }
  },
  "wood_teak": {
    "label": "ไม้สัก",
    "sources": [
      "https://polyhaven.com/a/teak_veneer"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/wood_teak/color.jpg",
        "identity": "teak_veneer:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/wood_teak/normal.jpg",
        "identity": "teak_veneer:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/wood_teak/roughness.jpg",
        "identity": "teak_veneer:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/wood_teak/ao.jpg",
        "identity": "teak_veneer:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "wood_painted": {
    "label": "ไม้ทาสี",
    "sources": [
      "https://polyhaven.com/a/white_planks_clean"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/wood_painted/color.jpg",
        "identity": "white_planks_clean:Diffuse",
        "meters": [
          1.8000000715255737,
          1.8000000715255737
        ]
      },
      "normal": {
        "file": "assets/textures/wood_painted/normal.jpg",
        "identity": "white_planks_clean:nor_gl",
        "meters": [
          1.8000000715255737,
          1.8000000715255737
        ]
      },
      "roughness": {
        "file": "assets/textures/wood_painted/roughness.jpg",
        "identity": "white_planks_clean:Rough",
        "meters": [
          1.8000000715255737,
          1.8000000715255737
        ]
      },
      "ao": {
        "file": "assets/textures/wood_painted/ao.jpg",
        "identity": "white_planks_clean:AO",
        "meters": [
          1.8000000715255737,
          1.8000000715255737
        ]
      }
    }
  },
  "metal_steel": {
    "label": "เหล็ก",
    "sources": [
      "https://ambientcg.com/view?id=Metal032"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/metal_steel/color.jpg",
        "identity": "Metal032:Color",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/metal_steel/normal.jpg",
        "identity": "Metal032:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/metal_steel/roughness.jpg",
        "identity": "Metal032:Roughness",
        "meters": [
          1.0,
          1.0
        ]
      },
      "metalness": {
        "file": "assets/textures/metal_steel/metalness.jpg",
        "identity": "Metal032:Metalness",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "metal_painted": {
    "label": "เหล็กทาสี",
    "sources": [
      "https://polyhaven.com/a/blue_metal_plate"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/metal_painted/color.jpg",
        "identity": "blue_metal_plate:Diffuse",
        "meters": [
          2.5,
          2.5
        ]
      },
      "normal": {
        "file": "assets/textures/metal_painted/normal.jpg",
        "identity": "blue_metal_plate:nor_gl",
        "meters": [
          2.5,
          2.5
        ]
      },
      "roughness": {
        "file": "assets/textures/metal_painted/roughness.jpg",
        "identity": "blue_metal_plate:Rough",
        "meters": [
          2.5,
          2.5
        ]
      },
      "ao": {
        "file": "assets/textures/metal_painted/ao.jpg",
        "identity": "blue_metal_plate:AO",
        "meters": [
          2.5,
          2.5
        ]
      }
    }
  },
  "roller_shutter": {
    "label": "ประตูเหล็กม้วน",
    "sources": [
      "https://polyhaven.com/a/painted_metal_shutter"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/roller_shutter/color.jpg",
        "identity": "painted_metal_shutter:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/roller_shutter/normal.jpg",
        "identity": "painted_metal_shutter:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/roller_shutter/roughness.jpg",
        "identity": "painted_metal_shutter:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/roller_shutter/ao.jpg",
        "identity": "painted_metal_shutter:AO",
        "meters": [
          2.0,
          2.0
        ]
      }
    }
  },
  "glass_clear": {
    "label": "กระจกใส",
    "sources": [
      "https://ambientcg.com/view?id=SurfaceImperfections001"
    ],
    "maps": {
      "normal": {
        "file": "assets/textures/glass_clear/normal.jpg",
        "identity": "SurfaceImperfections001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/glass_clear/roughness.jpg",
        "identity": "SurfaceImperfections001:Opacity",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "glass_tinted": {
    "label": "กระจกสี",
    "sources": [
      "https://ambientcg.com/view?id=SurfaceImperfections001"
    ],
    "maps": {
      "normal": {
        "file": "assets/textures/glass_tinted/normal.jpg",
        "identity": "SurfaceImperfections001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/glass_tinted/roughness.jpg",
        "identity": "SurfaceImperfections001:Opacity",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "asphalt": {
    "label": "ยางมะตอย",
    "sources": [
      "https://polyhaven.com/a/clean_asphalt"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/asphalt/color.jpg",
        "identity": "clean_asphalt:Diffuse",
        "meters": [
          2.0999999046325684,
          2.0999999046325684
        ]
      },
      "normal": {
        "file": "assets/textures/asphalt/normal.jpg",
        "identity": "clean_asphalt:nor_gl",
        "meters": [
          2.0999999046325684,
          2.0999999046325684
        ]
      },
      "roughness": {
        "file": "assets/textures/asphalt/roughness.jpg",
        "identity": "clean_asphalt:Rough",
        "meters": [
          2.0999999046325684,
          2.0999999046325684
        ]
      },
      "ao": {
        "file": "assets/textures/asphalt/ao.jpg",
        "identity": "clean_asphalt:AO",
        "meters": [
          2.0999999046325684,
          2.0999999046325684
        ]
      }
    }
  },
  "road_marking_white": {
    "label": "สีถนนขาว",
    "sources": [
      "https://polyhaven.com/a/white_plaster_02"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/road_marking_white/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/road_marking_white/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/road_marking_white/roughness.jpg",
        "identity": "white_plaster_02:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/road_marking_white/ao.jpg",
        "identity": "white_plaster_02:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "road_marking_yellow": {
    "label": "สีถนนเหลือง",
    "sources": [
      "https://polyhaven.com/a/white_plaster_02"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/road_marking_yellow/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/road_marking_yellow/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/road_marking_yellow/roughness.jpg",
        "identity": "white_plaster_02:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/road_marking_yellow/ao.jpg",
        "identity": "white_plaster_02:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "sidewalk_tile": {
    "label": "กระเบื้องทางเท้า",
    "sources": [
      "https://polyhaven.com/a/checkered_pavement_tiles"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/sidewalk_tile/color.jpg",
        "identity": "checkered_pavement_tiles:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sidewalk_tile/normal.jpg",
        "identity": "checkered_pavement_tiles:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sidewalk_tile/roughness.jpg",
        "identity": "checkered_pavement_tiles:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sidewalk_tile/ao.jpg",
        "identity": "checkered_pavement_tiles:AO",
        "meters": [
          2.0,
          2.0
        ]
      }
    }
  },
  "curb_red_white": {
    "label": "ขอบทางแดงขาว",
    "sources": [
      "https://polyhaven.com/a/white_plaster_02"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/curb_red_white/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/curb_red_white/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/curb_red_white/roughness.jpg",
        "identity": "white_plaster_02:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/curb_red_white/ao.jpg",
        "identity": "white_plaster_02:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    },
    "pattern": "curb"
  },
  "grass": {
    "label": "หญ้า",
    "sources": [
      "https://polyhaven.com/a/grass_ground"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/grass/color.jpg",
        "identity": "grass_ground:Diffuse",
        "meters": [
          2.509999990463257,
          2.509999990463257
        ]
      },
      "normal": {
        "file": "assets/textures/grass/normal.jpg",
        "identity": "grass_ground:nor_gl",
        "meters": [
          2.509999990463257,
          2.509999990463257
        ]
      },
      "roughness": {
        "file": "assets/textures/grass/roughness.jpg",
        "identity": "grass_ground:Rough",
        "meters": [
          2.509999990463257,
          2.509999990463257
        ]
      },
      "ao": {
        "file": "assets/textures/grass/ao.jpg",
        "identity": "grass_ground:AO",
        "meters": [
          2.509999990463257,
          2.509999990463257
        ]
      }
    }
  },
  "dirt_laterite": {
    "label": "ดินลูกรัง",
    "sources": [
      "https://polyhaven.com/a/red_laterite_soil_stones"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/dirt_laterite/color.jpg",
        "identity": "red_laterite_soil_stones:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/dirt_laterite/normal.jpg",
        "identity": "red_laterite_soil_stones:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/dirt_laterite/roughness.jpg",
        "identity": "red_laterite_soil_stones:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/dirt_laterite/ao.jpg",
        "identity": "red_laterite_soil_stones:AO",
        "meters": [
          2.0,
          2.0
        ]
      }
    }
  },
  "gravel_ballast": {
    "label": "หินโรยทาง",
    "sources": [
      "https://polyhaven.com/a/gravel_floor_02"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/gravel_ballast/color.jpg",
        "identity": "gravel_floor_02:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/gravel_ballast/normal.jpg",
        "identity": "gravel_floor_02:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/gravel_ballast/roughness.jpg",
        "identity": "gravel_floor_02:Rough",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/gravel_ballast/ao.jpg",
        "identity": "gravel_floor_02:AO",
        "meters": [
          2.0,
          2.0
        ]
      }
    }
  },
  "water_river": {
    "label": "น้ำแม่น้ำ",
    "sources": [
      "https://ambientcg.com/view?id=SurfaceImperfections001"
    ],
    "maps": {
      "normal": {
        "file": "assets/textures/water_river/normal.jpg",
        "identity": "SurfaceImperfections001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/water_river/roughness.jpg",
        "identity": "SurfaceImperfections001:Opacity",
        "meters": [
          1.0,
          1.0
        ]
      }
    },
    "pattern": "water"
  },
  "water_flood": {
    "label": "น้ำท่วม",
    "sources": [
      "https://ambientcg.com/view?id=SurfaceImperfections001"
    ],
    "maps": {
      "normal": {
        "file": "assets/textures/water_flood/normal.jpg",
        "identity": "SurfaceImperfections001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/water_flood/roughness.jpg",
        "identity": "SurfaceImperfections001:Opacity",
        "meters": [
          1.0,
          1.0
        ]
      }
    },
    "pattern": "water"
  },
  "foliage_tropical": {
    "label": "ใบไม้เขตร้อน",
    "sources": [
      "https://ambientcg.com/view?id=Leaf001"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/foliage_tropical/color.jpg",
        "identity": "Leaf001:Color",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/foliage_tropical/normal.jpg",
        "identity": "Leaf001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/foliage_tropical/roughness.jpg",
        "identity": "Leaf001:Roughness",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/foliage_tropical/ao.jpg",
        "identity": "Leaf001:AmbientOcclusion",
        "meters": [
          1.0,
          1.0
        ]
      },
      "alpha": {
        "file": "assets/textures/foliage_tropical/alpha.jpg",
        "identity": "Leaf001:Opacity",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "fabric_canvas": {
    "label": "ผ้าใบ",
    "sources": [
      "https://polyhaven.com/a/cotton_jersey"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/fabric_canvas/color.jpg",
        "identity": "cotton_jersey:Diffuse",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      },
      "normal": {
        "file": "assets/textures/fabric_canvas/normal.jpg",
        "identity": "cotton_jersey:nor_gl",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      },
      "roughness": {
        "file": "assets/textures/fabric_canvas/roughness.jpg",
        "identity": "cotton_jersey:Rough",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      },
      "ao": {
        "file": "assets/textures/fabric_canvas/ao.jpg",
        "identity": "cotton_jersey:AO",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      },
      "metalness": {
        "file": "assets/textures/fabric_canvas/metalness.jpg",
        "identity": "cotton_jersey:Metal",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      }
    }
  },
  "sign_thai": {
    "label": "ป้ายภาษาไทย",
    "sources": [
      "https://polyhaven.com/a/white_plaster_02"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/sign_thai/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sign_thai/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sign_thai/roughness.jpg",
        "identity": "white_plaster_02:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sign_thai/ao.jpg",
        "identity": "white_plaster_02:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  },
  "emissive_window": {
    "label": "หน้าต่างมีแสง",
    "sources": [
      "https://polyhaven.com/a/white_plaster_02"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/emissive_window/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/emissive_window/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/emissive_window/roughness.jpg",
        "identity": "white_plaster_02:Rough",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/emissive_window/ao.jpg",
        "identity": "white_plaster_02:AO",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  }
} as const satisfies Record<MaterialKey, TextureDefinition>;

export const DAY_SKY_URL = 'assets/textures/sky/kloofendal_43d_clear_puresky_1k.hdr';
