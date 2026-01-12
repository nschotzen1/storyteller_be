class Student {
    constructor(name, faculty) {
        this.name = name;
        this.faculty = faculty;
        this.grades = [];
    }

    addGrade(grade) {
        if (typeof grade !== 'number' || grade < 0 || grade > 100) {
            throw new Error('Grade must be a number between 0 and 100.');
        }
        this.grades.push(grade);
    }

    changeFaculty(newFaculty) {
        this.faculty = newFaculty;
    }

    getAverageGrade() {
        if (this.grades.length === 0) return 0;
        const sum = this.grades.reduce((acc, val) => acc + val, 0);
        return sum / this.grades.length;
    }
}

class University {
    constructor() {
        this.students = new Map();
    }

    addStudent(student) {
        if (!(student instanceof Student)) {
            throw new Error('Only Student instances can be added.');
        }
        this.students.set(student.name, student);
    }

    removeStudent(studentName) {
        this.students.delete(studentName);
    }

    getAverageOfStudentsAverages() {
        if (this.students.size === 0) return 0;
        const totalAvg = Array.from(this.students.values()).reduce((acc, student) => acc + student.getAverageGrade(), 0);
        return totalAvg / this.students.size;
    }

    findMostExcellentStudent() {
        if (this.students.size === 0) return null;
        return Array.from(this.students.values()).reduce((best, student) => 
            student.getAverageGrade() > (best ? best.getAverageGrade() : -Infinity) ? student : best, null
        );
    }
}


// Example usage:
// const uni = new University();
// const s1 = new Student('Alice', 'Engineering');
// s1.addGrade(90);
// s1.addGrade(85);
// uni.addStudent(s1);
// const s2 = new Student('Bob', 'Science');
// s2.addGrade(95);
// uni.addStudent(s2);
// console.log(uni.getAverageOfStudentsAverages());
// console.log(uni.findMostExcellentStudent());