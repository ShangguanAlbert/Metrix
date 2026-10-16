import { latestPublishedClassroomLesson, publishedClassroomTaskText } from "../../../shared/classroomPublication.js";

export async function syncPublishedClassroomRooms({ lessons, classNames, deps }) {
  const { AuthUser, GroupChatRoom, broadcastGroupChatRoomUpdated, broadcastGroupChatWsPayload } = deps;
  for (const className of new Set(classNames.filter(Boolean))) {
    const students = await AuthUser.find({ lockedTeacherScopeKey: "shi-gaojun", "profile.className": className }, { _id: 1 }).lean();
    const studentIds = students.map((student) => String(student._id));
    const roomQuery = {
      teacherScopeKey: "shi-gaojun",
      memberUserIds: { $in: studentIds, $not: { $elemMatch: { $nin: studentIds } } },
    };
    const lesson = latestPublishedClassroomLesson(lessons, className);
    // Only the published task changes; room attachments and student work stay intact.
    await GroupChatRoom.updateMany(roomQuery, { $set: { announcement: publishedClassroomTaskText(lesson) } });
    const rooms = await GroupChatRoom.find(roomQuery).lean();
    for (const room of rooms) {
      deps.partyActivity?.record({ roomId: String(room._id), eventType: "task_published",
        metadata: { lessonId: lesson?.id || "", lessonSnapshot: lesson || null }, authorized: true });
      broadcastGroupChatRoomUpdated(String(room._id), room);
      broadcastGroupChatWsPayload(String(room._id), {
        type: "coding_collab_template_published", roomId: String(room._id), lessonId: lesson?.id || "",
      });
    }
  }
}
