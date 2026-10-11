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

/** Source dimensions preserve world-scale repeats. Scalar maps alias one source ORM
 * image: AO reads R, roughness reads G, metalness reads B, all in NoColorSpace.
 * Cement roofing retains its independent AO and roughness source scales.
 */
export const TEXTURE_CATALOG = {
  "plaster_white": {
    "label": "ปูนขาวเก่าคราบฝน",
    "sources": [
      "https://polyhaven.com/a/white_plaster_rough_01"
    ],
    "maps": {
      "color": {
        "file": "assets/textures/sources/white_plaster_rough_01/color.jpg",
        "identity": "white_plaster_rough_01:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_plaster_rough_01/normal.jpg",
        "identity": "white_plaster_rough_01:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_plaster_rough_01/orm.jpg",
        "identity": "white_plaster_rough_01:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_plaster_rough_01/orm.jpg",
        "identity": "white_plaster_rough_01:ORM",
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
        "file": "assets/textures/sources/white_plaster_rough_01/color.jpg",
        "identity": "white_plaster_rough_01:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_plaster_rough_01/normal.jpg",
        "identity": "white_plaster_rough_01:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_plaster_rough_01/orm.jpg",
        "identity": "white_plaster_rough_01:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_plaster_rough_01/orm.jpg",
        "identity": "white_plaster_rough_01:ORM",
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
        "file": "assets/textures/sources/white_plaster_rough_01/color.jpg",
        "identity": "white_plaster_rough_01:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_plaster_rough_01/normal.jpg",
        "identity": "white_plaster_rough_01:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_plaster_rough_01/orm.jpg",
        "identity": "white_plaster_rough_01:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_plaster_rough_01/orm.jpg",
        "identity": "white_plaster_rough_01:ORM",
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
        "file": "assets/textures/sources/concrete_wall_006/color.jpg",
        "identity": "concrete_wall_006:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/concrete_wall_006/normal.jpg",
        "identity": "concrete_wall_006:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/concrete_wall_006/orm.jpg",
        "identity": "concrete_wall_006:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/concrete_wall_006/orm.jpg",
        "identity": "concrete_wall_006:ORM",
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
        "file": "assets/textures/sources/concrete_floor_02/color.jpg",
        "identity": "concrete_floor_02:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/concrete_floor_02/normal.jpg",
        "identity": "concrete_floor_02:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/concrete_floor_02/orm.jpg",
        "identity": "concrete_floor_02:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/concrete_floor_02/orm.jpg",
        "identity": "concrete_floor_02:ORM",
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
        "file": "assets/textures/sources/red_brick/color.jpg",
        "identity": "red_brick:Diffuse",
        "meters": [
          1.399999976158142,
          1.399999976158142
        ]
      },
      "normal": {
        "file": "assets/textures/sources/red_brick/normal.jpg",
        "identity": "red_brick:nor_gl",
        "meters": [
          1.399999976158142,
          1.399999976158142
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/red_brick/orm.jpg",
        "identity": "red_brick:ORM",
        "meters": [
          1.399999976158142,
          1.399999976158142
        ]
      },
      "ao": {
        "file": "assets/textures/sources/red_brick/orm.jpg",
        "identity": "red_brick:ORM",
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
        "file": "assets/textures/sources/clay_roof_tiles/color.jpg",
        "identity": "clay_roof_tiles:Diffuse",
        "meters": [
          4.0,
          4.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/clay_roof_tiles/normal.jpg",
        "identity": "clay_roof_tiles:nor_gl",
        "meters": [
          4.0,
          4.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/clay_roof_tiles/orm.jpg",
        "identity": "clay_roof_tiles:ORM",
        "meters": [
          4.0,
          4.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/clay_roof_tiles/orm.jpg",
        "identity": "clay_roof_tiles:ORM",
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
        "file": "assets/textures/sources/concrete_wall_006/color.jpg",
        "identity": "concrete_wall_006:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/corrugated_iron/normal.jpg",
        "identity": "corrugated_iron:nor_gl",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/concrete_wall_006/orm.jpg",
        "identity": "concrete_wall_006:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/corrugated_iron/orm.jpg",
        "identity": "corrugated_iron:ORM",
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
        "file": "assets/textures/sources/corrugated_iron/color.jpg",
        "identity": "corrugated_iron:Diffuse",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "normal": {
        "file": "assets/textures/sources/corrugated_iron/normal.jpg",
        "identity": "corrugated_iron:nor_gl",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/corrugated_iron/orm.jpg",
        "identity": "corrugated_iron:ORM",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "ao": {
        "file": "assets/textures/sources/corrugated_iron/orm.jpg",
        "identity": "corrugated_iron:ORM",
        "meters": [
          1.1200000047683716,
          1.1200000047683716
        ]
      },
      "metalness": {
        "file": "assets/textures/sources/corrugated_iron/orm.jpg",
        "identity": "corrugated_iron:ORM",
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
        "file": "assets/textures/sources/rusty_corrugated_iron/color.jpg",
        "identity": "rusty_corrugated_iron:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/rusty_corrugated_iron/normal.jpg",
        "identity": "rusty_corrugated_iron:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/rusty_corrugated_iron/orm.jpg",
        "identity": "rusty_corrugated_iron:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/rusty_corrugated_iron/orm.jpg",
        "identity": "rusty_corrugated_iron:ORM",
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
        "file": "assets/textures/sources/box_profile_metal_sheet/color.jpg",
        "identity": "box_profile_metal_sheet:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/box_profile_metal_sheet/normal.jpg",
        "identity": "box_profile_metal_sheet:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/box_profile_metal_sheet/orm.jpg",
        "identity": "box_profile_metal_sheet:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/box_profile_metal_sheet/orm.jpg",
        "identity": "box_profile_metal_sheet:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "metalness": {
        "file": "assets/textures/sources/box_profile_metal_sheet/orm.jpg",
        "identity": "box_profile_metal_sheet:ORM",
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
        "file": "assets/textures/sources/teak_veneer/color.jpg",
        "identity": "teak_veneer:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/teak_veneer/normal.jpg",
        "identity": "teak_veneer:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/teak_veneer/orm.jpg",
        "identity": "teak_veneer:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/teak_veneer/orm.jpg",
        "identity": "teak_veneer:ORM",
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
        "file": "assets/textures/sources/white_planks_clean/color.jpg",
        "identity": "white_planks_clean:Diffuse",
        "meters": [
          1.8000000715255737,
          1.8000000715255737
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_planks_clean/normal.jpg",
        "identity": "white_planks_clean:nor_gl",
        "meters": [
          1.8000000715255737,
          1.8000000715255737
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_planks_clean/orm.jpg",
        "identity": "white_planks_clean:ORM",
        "meters": [
          1.8000000715255737,
          1.8000000715255737
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_planks_clean/orm.jpg",
        "identity": "white_planks_clean:ORM",
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
        "file": "assets/textures/sources/Metal032/color.jpg",
        "identity": "Metal032:Color",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/Metal032/normal.jpg",
        "identity": "Metal032:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/Metal032/orm.jpg",
        "identity": "Metal032:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "metalness": {
        "file": "assets/textures/sources/Metal032/orm.jpg",
        "identity": "Metal032:ORM",
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
        "file": "assets/textures/sources/blue_metal_plate/color.jpg",
        "identity": "blue_metal_plate:Diffuse",
        "meters": [
          2.5,
          2.5
        ]
      },
      "normal": {
        "file": "assets/textures/sources/blue_metal_plate/normal.jpg",
        "identity": "blue_metal_plate:nor_gl",
        "meters": [
          2.5,
          2.5
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/blue_metal_plate/orm.jpg",
        "identity": "blue_metal_plate:ORM",
        "meters": [
          2.5,
          2.5
        ]
      },
      "ao": {
        "file": "assets/textures/sources/blue_metal_plate/orm.jpg",
        "identity": "blue_metal_plate:ORM",
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
        "file": "assets/textures/sources/painted_metal_shutter/color.jpg",
        "identity": "painted_metal_shutter:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/painted_metal_shutter/normal.jpg",
        "identity": "painted_metal_shutter:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/painted_metal_shutter/orm.jpg",
        "identity": "painted_metal_shutter:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/painted_metal_shutter/orm.jpg",
        "identity": "painted_metal_shutter:ORM",
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
        "file": "assets/textures/sources/SurfaceImperfections001/normal.jpg",
        "identity": "SurfaceImperfections001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/SurfaceImperfections001/orm.jpg",
        "identity": "SurfaceImperfections001:ORM",
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
        "file": "assets/textures/sources/SurfaceImperfections001/normal.jpg",
        "identity": "SurfaceImperfections001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/SurfaceImperfections001/orm.jpg",
        "identity": "SurfaceImperfections001:ORM",
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
        "file": "assets/textures/sources/clean_asphalt/color.jpg",
        "identity": "clean_asphalt:Diffuse",
        "meters": [
          2.0999999046325684,
          2.0999999046325684
        ]
      },
      "normal": {
        "file": "assets/textures/sources/clean_asphalt/normal.jpg",
        "identity": "clean_asphalt:nor_gl",
        "meters": [
          2.0999999046325684,
          2.0999999046325684
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/clean_asphalt/orm.jpg",
        "identity": "clean_asphalt:ORM",
        "meters": [
          2.0999999046325684,
          2.0999999046325684
        ]
      },
      "ao": {
        "file": "assets/textures/sources/clean_asphalt/orm.jpg",
        "identity": "clean_asphalt:ORM",
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
        "file": "assets/textures/sources/white_plaster_02/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_plaster_02/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
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
        "file": "assets/textures/sources/white_plaster_02/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_plaster_02/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
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
        "file": "assets/textures/sources/checkered_pavement_tiles/color.jpg",
        "identity": "checkered_pavement_tiles:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/checkered_pavement_tiles/normal.jpg",
        "identity": "checkered_pavement_tiles:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/checkered_pavement_tiles/orm.jpg",
        "identity": "checkered_pavement_tiles:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/checkered_pavement_tiles/orm.jpg",
        "identity": "checkered_pavement_tiles:ORM",
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
        "file": "assets/textures/sources/white_plaster_02/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_plaster_02/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
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
        "file": "assets/textures/sources/grass_ground/color.jpg",
        "identity": "grass_ground:Diffuse",
        "meters": [
          2.509999990463257,
          2.509999990463257
        ]
      },
      "normal": {
        "file": "assets/textures/sources/grass_ground/normal.jpg",
        "identity": "grass_ground:nor_gl",
        "meters": [
          2.509999990463257,
          2.509999990463257
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/grass_ground/orm.jpg",
        "identity": "grass_ground:ORM",
        "meters": [
          2.509999990463257,
          2.509999990463257
        ]
      },
      "ao": {
        "file": "assets/textures/sources/grass_ground/orm.jpg",
        "identity": "grass_ground:ORM",
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
        "file": "assets/textures/sources/red_laterite_soil_stones/color.jpg",
        "identity": "red_laterite_soil_stones:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/red_laterite_soil_stones/normal.jpg",
        "identity": "red_laterite_soil_stones:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/red_laterite_soil_stones/orm.jpg",
        "identity": "red_laterite_soil_stones:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/red_laterite_soil_stones/orm.jpg",
        "identity": "red_laterite_soil_stones:ORM",
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
        "file": "assets/textures/sources/gravel_floor_02/color.jpg",
        "identity": "gravel_floor_02:Diffuse",
        "meters": [
          2.0,
          2.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/gravel_floor_02/normal.jpg",
        "identity": "gravel_floor_02:nor_gl",
        "meters": [
          2.0,
          2.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/gravel_floor_02/orm.jpg",
        "identity": "gravel_floor_02:ORM",
        "meters": [
          2.0,
          2.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/gravel_floor_02/orm.jpg",
        "identity": "gravel_floor_02:ORM",
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
        "file": "assets/textures/sources/SurfaceImperfections001/normal.jpg",
        "identity": "SurfaceImperfections001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/SurfaceImperfections001/orm.jpg",
        "identity": "SurfaceImperfections001:ORM",
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
        "file": "assets/textures/sources/SurfaceImperfections001/normal.jpg",
        "identity": "SurfaceImperfections001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/SurfaceImperfections001/orm.jpg",
        "identity": "SurfaceImperfections001:ORM",
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
        "file": "assets/textures/sources/Leaf001/color.jpg",
        "identity": "Leaf001:Color",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/Leaf001/normal.jpg",
        "identity": "Leaf001:NormalGL",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/Leaf001/orm.jpg",
        "identity": "Leaf001:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/Leaf001/orm.jpg",
        "identity": "Leaf001:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "alpha": {
        "file": "assets/textures/sources/Leaf001/alpha.webp",
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
        "file": "assets/textures/sources/cotton_jersey/color.jpg",
        "identity": "cotton_jersey:Diffuse",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      },
      "normal": {
        "file": "assets/textures/sources/cotton_jersey/normal.jpg",
        "identity": "cotton_jersey:nor_gl",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/cotton_jersey/orm.jpg",
        "identity": "cotton_jersey:ORM",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      },
      "ao": {
        "file": "assets/textures/sources/cotton_jersey/orm.jpg",
        "identity": "cotton_jersey:ORM",
        "meters": [
          0.2636027473872483,
          0.2637999951839447
        ]
      },
      "metalness": {
        "file": "assets/textures/sources/cotton_jersey/orm.jpg",
        "identity": "cotton_jersey:ORM",
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
        "file": "assets/textures/sources/white_plaster_02/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_plaster_02/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
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
        "file": "assets/textures/sources/white_plaster_02/color.jpg",
        "identity": "white_plaster_02:Diffuse",
        "meters": [
          1.0,
          1.0
        ]
      },
      "normal": {
        "file": "assets/textures/sources/white_plaster_02/normal.jpg",
        "identity": "white_plaster_02:nor_gl",
        "meters": [
          1.0,
          1.0
        ]
      },
      "roughness": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
        "meters": [
          1.0,
          1.0
        ]
      },
      "ao": {
        "file": "assets/textures/sources/white_plaster_02/orm.jpg",
        "identity": "white_plaster_02:ORM",
        "meters": [
          1.0,
          1.0
        ]
      }
    }
  }
} as const satisfies Record<MaterialKey, TextureDefinition>;

export const DAY_SKY_URL = 'assets/textures/sky/kloofendal_43d_clear_puresky_1k.hdr';
