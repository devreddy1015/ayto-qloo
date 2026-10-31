import React from "react";
import { Composition } from "remotion";
import { Main } from "./Main";
import { FPS, TOTAL } from "./timeline";

export const Root: React.FC = () => (
  <Composition id="AytoDemo" component={Main} defaultProps={{ bgm: true, captions: true }} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);
