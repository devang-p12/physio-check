import React from "react";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); 
// 9AM – 8PM

const GoogleWeekCalendar = ({
  availability = [],
  appointments = [],
  onSlotClick,
  isDoctorView = false,
}) => {
  const today = new Date();

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(today.getDate() + i);
    return date;
  });

  const getSlotStatus = (date, hour) => {
    const now = new Date();
    const slotTime = new Date(date);
    slotTime.setHours(hour, 0, 0, 0);

    if (slotTime < now) return "past";

    const appt = appointments.find((a) => {
      const apptDate = new Date(a.startTime);
      return (
        apptDate.toDateString() === date.toDateString() &&
        apptDate.getHours() === hour
      );
    });

    if (appt) return appt.status;

    const dayOfWeek = date.getDay();
    const available = availability.some(
      (a) =>
        a.dayOfWeek === dayOfWeek &&
        hour >= Number(a.startTime.split(":")[0]) &&
        hour < Number(a.endTime.split(":")[0])
    );

    return available ? "available" : "unavailable";
  };

  const getColor = (status) => {
    switch (status) {
      case "available":
        return "bg-green-100 hover:bg-green-200 cursor-pointer";
      case "pending":
        return "bg-blue-200";
      case "approved":
        return "bg-teal-300";
      case "rejected":
        return "bg-red-200";
      case "past":
        return "bg-gray-300";
      default:
        return "bg-gray-100";
    }
  };

  return (
    <div className="overflow-x-auto border rounded-xl shadow">
      <div className="grid grid-cols-8 min-w-[900px]">
        <div className="bg-slate-100 p-3 font-bold text-center">Time</div>

        {weekDays.map((day, i) => (
          <div
            key={i}
            className="bg-slate-100 p-3 text-center font-semibold border-l"
          >
            {day.toLocaleDateString("en-US", { weekday: "short" })}
            <div className="text-xs text-slate-500">
              {day.getDate()}
            </div>
          </div>
        ))}

        {HOURS.map((hour) => (
          <React.Fragment key={hour}>
            <div className="border-t p-3 text-sm text-center bg-slate-50">
              {hour}:00
            </div>

            {weekDays.map((day, i) => {
              const status = getSlotStatus(day, hour);

              return (
                <div
                  key={i}
                  className={`border-t border-l p-3 transition ${getColor(status)}`}
                  onClick={() =>
                    status === "available" &&
                    onSlotClick?.(day, hour)
                  }
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default GoogleWeekCalendar;
