import type1 from "./type1.png";
import type2 from "./type2.png";
import type3 from "./type3.png";
import type4 from "./type4.png";
import type5 from "./type5.png";
import type6 from "./type6.png";
import type7 from "./type7.png";
import type8 from "./type8.png";
import type9 from "./type9.png";
import type10 from "./type10.png";
import type11 from "./type11.png";
import type12 from "./type12.png";
import { loadHero } from "../../library/loadHero";

export const SPRITES = [
	await loadHero(type1),
	await loadHero(type2),
	await loadHero(type3),
	await loadHero(type4),
	await loadHero(type5),
	await loadHero(type6),
	await loadHero(type7),
	await loadHero(type8),
	await loadHero(type9),
	await loadHero(type10),
	await loadHero(type11),
	await loadHero(type12)
] as const;