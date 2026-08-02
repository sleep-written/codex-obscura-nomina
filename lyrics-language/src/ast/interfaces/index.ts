export type {
    AlterableMarker,
    CommentNode,
    TitledText,
    SyllableNode,
    WordNode,
    VerseNode,
    StanzaNode,
    SongNode
} from './song.js';
export type {
    MetadataValueKind,
    MetadataKey,
    SongMetadataKey,
    StanzaMetadataKey,
    MetadataEntry,
    TextMetadataEntry,
    NumberMetadataEntry,
    SongMetadata,
    StanzaMetadata
} from './metadata.js';
export {
    SONG_METADATA_SPEC,
    STANZA_METADATA_SPEC,
    emptySongMetadata,
    emptyStanzaMetadata,
    metadataSlots
} from './metadata.js';
export type { Position, Range } from './position.js';
