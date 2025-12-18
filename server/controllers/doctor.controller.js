import { assignments } from "../data/db.js";
import { createAssignment } from "../models/Assignment.model.js";

export const assignExercise = (req,res) => {
    const {patientId , exerciseId , date} = req.body;

    if(!patientId || !exerciseId || !date){
        return res.status(400).json({message: "missing required fields"})
    }

    const assignment = createAssignment({
        doctorId: req.user.id,
        patientId,
        exerciseId,
        date
    });

    assignments.push(assignment);

    res.status(201).json({
        message: "Excercise assigned Successfully",
        assignment
    });
};

