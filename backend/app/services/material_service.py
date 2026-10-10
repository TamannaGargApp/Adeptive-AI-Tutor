"""Reading material (study notes) for each topic.

Notes are written by the AI the first time anyone opens a topic's Read mode, then stored and shared
by every learner, so later visits are instant and cost nothing. Admins can edit or regenerate them.
"""

from datetime import UTC, datetime

from app.db.mongodb import get_database
from app.models.topic import Topic
from app.prompts.tutor_prompt import build_material_prompt, subject_rules
from app.schemas.material import StudyMaterialResponse, TopicMaterialIn, TopicMaterialOut
from app.services import notes_service, subject_service, topic_service
from app.services.ai_service import StructuredLLM


async def get_material(topic_slug: str, ai: StructuredLLM) -> TopicMaterialOut:
    topic = await topic_service.get_topic(topic_slug)
    document = await get_database().topic_materials.find_one({"topic_slug": topic_slug})
    if document is None:
        document = await _generate_and_save(topic, ai)
    return _to_out(topic, document)


async def regenerate_material(topic_slug: str, ai: StructuredLLM) -> TopicMaterialOut:
    topic = await topic_service.get_topic(topic_slug)
    return _to_out(topic, await _generate_and_save(topic, ai))


async def update_material(topic_slug: str, data: TopicMaterialIn) -> TopicMaterialOut:
    topic = await topic_service.get_topic(topic_slug)
    document = await _save(topic_slug, data.content, data.key_takeaways, edited=True)
    return _to_out(topic, document)


async def _generate_and_save(topic: Topic, ai: StructuredLLM) -> dict:
    subject = await subject_service.get_subject(topic.subject)
    # Admin-uploaded course notes, if any, are the basis; the AI fills in what they lack.
    notes = await notes_service.get_full_notes(topic.slug)
    material = await ai.generate_structured(
        system_prompt=subject_rules(subject.name, subject.code_guidelines),
        user_prompt=build_material_prompt(
            subject.name,
            subject.language,
            topic.name,
            topic.description,
            topic.key_concepts,
            notes.text if notes else None,
        ),
        response_model=StudyMaterialResponse,
    )
    return await _save(topic.slug, fix_escaped_newlines(material.content).strip(), material.key_takeaways, edited=False)


async def _save(topic_slug: str, content: str, key_takeaways: list[str], edited: bool) -> dict:
    document = {
        "topic_slug": topic_slug,
        "content": content,
        "key_takeaways": [item.strip() for item in key_takeaways if item.strip()],
        "edited": edited,
        "updated_at": datetime.now(UTC),
    }
    await get_database().topic_materials.replace_one({"topic_slug": topic_slug}, document, upsert=True)
    return document


def fix_escaped_newlines(text: str) -> str:
    """Repair text where the AI wrote line breaks as literal "\\n" characters, which stops Markdown
    from rendering. Only applied when escaped breaks clearly outnumber real ones, so a code example
    that deliberately prints "\\n" is left alone."""
    if text.count("\\n") <= text.count("\n"):
        return text
    return text.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\t", "    ").replace('\\"', '"')


def _to_out(topic: Topic, document: dict) -> TopicMaterialOut:
    return TopicMaterialOut(
        topic_slug=topic.slug,
        topic_name=topic.name,
        # Also repairs notes saved before this fix, without regenerating them.
        content=fix_escaped_newlines(document["content"]),
        key_takeaways=document.get("key_takeaways", []),
        updated_at=document["updated_at"],
        edited=document.get("edited", False),
    )