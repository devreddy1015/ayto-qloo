import React from "react";
import { Composition } from "remotion";
import { DROP_TOTAL, DropMain, FILM_TOTAL, Main } from "./Main";
import { FPS } from "./timeline";

export const Root: React.FC = () => (
  <>
    {/* The London crime film leads. */}
    <Composition id="AytoDemo" component={Main} defaultProps={{ bgm: true, captions: true }} durationInFrames={FILM_TOTAL} fps={FPS} width={1920} height={1080} />
    {/* A streetwear drop in Los Angeles leads; the film is one of the other formats. */}
    <Composition id="AytoDrop" component={DropMain} defaultProps={{ bgm: true, captions: true }} durationInFrames={DROP_TOTAL} fps={FPS} width={1920} height={1080} />
  </>
);
