import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {users} from "../data/db.js"
import { createUser } from "../models/User.model.js";

export const register = async (req,res) => {
    const {name,email,password,role} = req.body;

    const existingUser = users.find(u => {u.email == email});
    if(existingUser){
        return res.status(400).json({message: "User already Exists"});
    }

    const hashedPassword = await bcrypt.hash(password,10);

    const newUser = createUser({
        name,
        email,
        password: hashedPassword,
        role
    });

    users.push(newUser);

    res.status(201).json({message: "user registered successfully"});
};

export const login = async(req,res) => {
    const {email,password} = req.body;

    const user = users.find(u => u.email == email);
    if(!user){
        return res.status(401).json({message: "Invalid Credentials"});
    }

    const isMatch = await bcrypt.compare(password,user.password);
    if(!isMatch){
        return res.status(401).json({message: "Invalid Credentials"});
    }

    const token = jwt.sign(
        { id: user.id, role: user.role},
        "secret123",
        {expiresIn: "1d"}
    );

    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            role: user.role
        }
    });
};

