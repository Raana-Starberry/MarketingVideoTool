# MarketingVideoTool
Marketing Video Automation Tool
Here’s a cleaner version you can paste directly into Claude as a product/build prompt. I’ve structured it so Claude can understand the product architecture, workflow, and non-negotiable requirements without over-constraining the first implementation.

# AI Marketing Creative Video Generator

I want to build an AI-powered creative video generation tool for producing marketing creatives for different styles and genres of games.

The product should feel similar in workflow to tools such as Higgsfield, but it should be focused specifically on creating game-marketing videos from a written concept, story, references, and character information.

The user should be able to describe a creative idea or story, and the system should turn it into structured scenes, generate the required visual assets, generate video clips, maintain consistency across the entire sequence, and finally allow the user to edit and combine the selected clips into a finished marketing video.

The system should be modular so that I can add or replace image models, video models, audio models, and other capabilities later.

## Core User Workflow

The intended workflow is:

Concept → Project → Story → Scene Breakdown → Scene JSON → Image Generation → Video Generation → Review Variations → Select Clips → Timeline → Captions / Music → Final Export

## 1. Project-Based Organization

Every creative concept should have its own **Project**.

A project should contain everything related to that creative:

* Original prompt
* Story
* Reference images
* Character sheets
* Environment references
* Style settings
* Generated scene descriptions
* Scene JSON
* Generated images
* Generated videos
* Variations
* Selected/favorited generations
* Captions
* Music
* Timeline
* Final exports

The interface should make it easy to move between different projects without mixing assets from one concept with another.

Within each scene or generation, I should be able to mark assets as:

* Selected
* Favorite
* Rejected
* Regenerate

## 2. References and Character Sheets

Every prompt/message or generation step should have an optional area where I can upload references.

References may include:

* Character sheets
* Character images
* Clothing references
* Environment references
* Art-direction references
* Game screenshots
* Props
* Camera/composition references
* Previous generated frames

The system should use these references to improve consistency throughout the project.

## 3. Visual Style Selection

Before generation, I should be able to select the intended visual style.

Examples:

* Realistic
* Cinematic realistic
* 3D animation
* Stylized 3D
* Cartoon
* Game cinematic
* Mobile-game advertising style
* Custom style based on references

The selected style must remain consistent throughout the entire video unless the user explicitly changes it.

There should be no accidental style drift between scenes.

## 4. Story-to-Scene Generation

The user should first be able to write the creative concept or full story in natural language.

The system should help refine the story before anything is generated.

Once the user confirms/finalizes the story, the system should automatically break it into individual scenes/shots.

For every scene, generate a detailed structured JSON representation.

The JSON should act as the source of truth for generation.

Each scene JSON should include information such as:

* Scene ID
* Scene duration
* Scene purpose
* Story beat
* Character(s)
* Character appearance
* Clothing
* Character position
* Character action
* Facial expression
* Lip-sync/dialogue information
* Environment
* Background
* Props
* Lighting
* Time of day
* Visual style
* Camera angle
* Camera lens
* Camera position
* Camera movement
* Framing
* Composition
* Depth of field
* Character movement
* Environmental movement
* Physics requirements
* Start-frame description
* End-frame description
* Previous-scene continuity information
* Next-scene transition
* Match-cut requirements
* Image-generation prompt
* Video-generation prompt
* Negative prompt
* Sound effects
* Dialogue
* Music direction
* Caption information

Example structure:

```json
{
  "scene_id": "scene_01",
  "duration": 5,
  "story_beat": "",
  "characters": [],
  "environment": {},
  "camera": {},
  "action": {},
  "lighting": {},
  "continuity": {},
  "transition": {},
  "image_prompt": "",
  "video_prompt": "",
  "negative_prompt": "",
  "dialogue": "",
  "audio": {},
  "caption": {}
}
```

The actual production schema can be more detailed than this example.

## 5. Image Generation

Use **Nano Banana** as one of the available image-generation models.

However, the architecture should not be locked to a single model.

I should be able to choose the image-generation provider/model before generation.

Design the image-generation layer as a provider abstraction so additional models can be added later.

For example:

Image Provider → Nano Banana / Other Provider / Future Provider

For each scene, the user should be able to:

* Generate an image
* Generate multiple variations
* Select a preferred image
* Regenerate
* Modify the prompt
* Use the previous scene/frame as a reference
* Use uploaded references
* Lock character/style/environment consistency

## 6. Strong Visual Consistency

Consistency is one of the highest-priority requirements.

Across scenes, preserve:

* Character identity
* Face
* Body proportions
* Hair
* Clothing
* Accessories
* Environment
* Architecture
* Props
* Lighting logic
* Color palette
* Visual style
* Scale
* Time of day when appropriate
* Camera/world continuity

Create a persistent project-level **Visual Bible / Consistency Profile** containing the canonical information for:

* Characters
* Clothing
* Environments
* Props
* Art direction
* Style
* Lighting
* Color palette

Every generation should refer back to this information.

Where supported by the generation model, use previous images, first/last frames, reference images, seeds, character references, or other consistency mechanisms.

## 7. Physics, Movement and Lip Sync

Generated videos should prioritize believable movement and physical continuity.

Avoid issues such as:

* Floating objects
* Incorrect gravity
* Sliding feet
* Broken anatomy
* Teleportation
* Characters changing position unexpectedly
* Objects disappearing
* Clothing changing
* Incorrect interaction with objects
* Impossible body movement

If dialogue exists, lip sync should accurately match:

* Spoken words
* Timing
* Mouth movement
* Facial expressions
* Emotion

The scene specification should explicitly include these requirements before generation.

## 8. Match Cuts and Scene Continuity

Transitions between scenes should feel like parts of one continuous story rather than unrelated AI clips.

When appropriate, the system should automatically plan match cuts.

For example, Scene 1's ending frame should inform Scene 2's starting frame.

Track continuity information including:

* Character position
* Pose
* Camera direction
* Movement direction
* Eye line
* Lighting
* Environment
* Props
* Action
* Camera motion
* Last frame

The generation system should use this information when creating the following scene.

The goal is to achieve seamless visual storytelling.

## 9. Video Generation Models

The product should support multiple video-generation providers.

Examples may include:

* Kling
* Veo
* Cinema Studio
* Future video models

Do not tightly couple the application to one provider.

Create a common Video Provider abstraction.

Each provider should expose its capabilities, such as:

* Minimum duration
* Maximum duration
* Supported resolutions
* Supported aspect ratios
* Image-to-video support
* Text-to-video support
* First-frame support
* Last-frame support
* Reference-image support
* Audio generation
* Native lip sync
* Camera controls
* Maximum prompt length

The UI should automatically adapt depending on the selected provider.

For example, if a model only supports 5-10 second generations, the user should only be able to select durations inside that range.

Do not hard-code one universal minimum or maximum video duration.

## 10. Prevent Style Drift

The system must actively prevent style changes during the video.

Every scene should reuse the project's selected:

* Style
* Character definitions
* Environment definitions
* Lighting direction
* Color palette
* Rendering style

If a generated result noticeably violates these constraints, allow the user to reject or regenerate it.

Eventually, this could include an automated consistency scoring system.

## 11. Captions

Include an optional caption/subtitle system.

The user should be able to:

* Enable captions
* Disable captions
* Edit text
* Change font
* Change font size
* Change text color
* Add background
* Change background opacity
* Highlight selected words
* Change highlight color
* Change caption position
* Control timing
* Create word-by-word captions
* Create sentence-based captions

Caption settings can be project-wide or customized for individual timeline clips.

## 12. Music and Audio

Include a Music section.

The user should have two options:

**Manual**
Upload or select a music track.

**Automatic**
Generate or recommend music based on:

* Story
* Pacing
* Genre
* Emotion
* Game style
* Scene timing

The timeline should eventually support:

* Music
* Dialogue
* Voiceover
* Sound effects
* Generated audio

Music should automatically fit the duration of the final edit when possible.

## 13. Timeline Editor

After generating multiple clips inside a project, the user should be able to select the clips they like and add them to a timeline.

The timeline should support at minimum:

* Drag-and-drop clip ordering
* Trim
* Split
* Delete
* Replace clip
* Duplicate clip
* Reorder
* Preview
* Captions
* Music
* Dialogue/audio tracks
* Transitions

The user should be able to choose between different generated variations for the same scene directly from the timeline.

The final timeline should be exportable as one combined video.

## Generation Hierarchy

Use this hierarchy when designing the system:

```text
Project
  ├── Creative Brief
  ├── Visual Bible
  │     ├── Characters
  │     ├── Clothing
  │     ├── Environments
  │     ├── Props
  │     └── Style
  │
  ├── Story
  │
  ├── Scenes
  │     ├── Scene 01
  │     │     ├── Scene JSON
  │     │     ├── References
  │     │     ├── Generated Images
  │     │     └── Generated Videos
  │     ├── Scene 02
  │     └── ...
  │
  ├── Audio
  │     ├── Dialogue
  │     ├── Music
  │     └── Sound Effects
  │
  ├── Captions
  │
  └── Timeline
        ├── Selected Clips
        ├── Audio Tracks
        ├── Captions
        └── Final Export
```

## Architecture Requirement

Build the application in a modular way.

Do not directly hard-code generation logic into the UI.

Use separate layers for:

```text
Frontend
↓
Project / Asset Management
↓
Story & Scene Planner
↓
Consistency Engine
↓
Prompt / Scene JSON Engine
↓
Generation Orchestrator
↓
Image Provider Layer
↓
Video Provider Layer
↓
Audio Provider Layer
↓
Asset Storage
↓
Timeline / Rendering Engine
```

Providers should use a common interface so models can easily be swapped or added later.

For example:

```typescript
interface VideoProvider {
  id: string;
  name: string;

  getCapabilities(): VideoCapabilities;

  generateVideo(
    request: VideoGenerationRequest
  ): Promise<VideoGenerationResult>;
}
```

Use a similar architecture for:

* Image providers
* Music providers
* Voice providers
* Lip-sync providers

## Important Product Principle

Do not treat each generated scene as an independent prompt.

The **Project**, **Visual Bible**, **previous scene**, **selected reference frames**, and **continuity data** should always be part of the generation context.

The system should think in terms of:

**one continuous creative composed of multiple generated shots**, rather than unrelated generated clips.

## MVP Priority

For the first version, prioritize:

1. Project creation
2. Story input
3. Character/reference uploads
4. Visual Bible
5. Style selection
6. Story-to-scene breakdown
7. Structured scene JSON
8. Image generation
9. Video generation
10. Generation variations
11. Favorite/select system
12. Cross-scene consistency
13. Timeline
14. Captions
15. Music
16. Final video export

Advanced editing features can be added later.

## Development Approach

Do not attempt to build everything as one giant component.

Start by defining:

* Data model
* Application architecture
* Provider interfaces
* Project structure
* Scene JSON schema
* Generation pipeline
* UI screens/components

Then implement the MVP in logical stages.

Before writing large amounts of code, first give me:

1. Recommended technical architecture
2. Database/data model
3. Project/file structure
4. Scene JSON schema
5. Provider abstraction design
6. Main UI screens
7. Generation workflow
8. Consistency strategy
9. MVP implementation phases

After presenting that architecture, begin implementing the application.

The system should be designed so I can continuously add new capabilities and requirements later without rebuilding the entire product.

One addition I strongly recommend is the **Visual Bible / Consistency Profile** concept above. Without a persistent source of truth for characters, environments, clothing, props, and style, even strong video models tend to treat each shot too independently.

I can also turn this into a more technical **Claude Code master prompt**, where Claude is instructed to actually build the app step-by-step with the frontend, database schema, API/provider adapters, scene JSON types, and initial UI.
