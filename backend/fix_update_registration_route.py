from pathlib import Path
path = Path('backend/routes/registrations.js')
text = path.read_text(encoding='utf-8')
start = text.find('//   try {')
end = text.find('// Admin - approve a pair', start)
if start == -1 or end == -1:
    raise SystemExit(f'Could not find replacement boundaries: start={start} end={end}')
new_block = '''  try {
    const { Tournament, Registration, Player } = getModelsForSport(req.admin.sport);
    const reg = await Registration.findById(req.params.id).populate('tournament');
    if (!reg) return res.status(404).json({ message: 'Registration not found' });
    if (reg.tournament.createdBy.toString() !== req.admin._id.toString()) return res.status(401).json({ message: 'Unauthorized' });

    const updatedFields = {};
    if (reg.playerName !== cleanedName) updatedFields.playerName = cleanedName;
    if (reg.nicNo !== cleanedNic) updatedFields.nicNo = cleanedNic;
    if (reg.address !== cleanedAddress) updatedFields.address = cleanedAddress;
    if (reg.email !== cleanedEmail) updatedFields.email = cleanedEmail;
    if (reg.phone !== cleanedPhone) updatedFields.phone = cleanedPhone;
    if (reg.rollNumber !== cleanedRoll) updatedFields.rollNumber = cleanedRoll;
    if (reg.department !== department) updatedFields.department = department;
    if (reg.partnerName !== cleanedPartnerName) updatedFields.partnerName = cleanedPartnerName;
    if (reg.partnerRollNumber !== cleanedPartnerRoll) updatedFields.partnerRollNumber = cleanedPartnerRoll;

    reg.playerName = cleanedName;
    reg.nicNo = cleanedNic;
    reg.address = cleanedAddress;
    reg.email = cleanedEmail;
    reg.phone = cleanedPhone;
    reg.rollNumber = cleanedRoll;
    reg.department = department;
    reg.partnerName = cleanedPartnerName;
    reg.partnerRollNumber = cleanedPartnerRoll;

    await reg.save();

    if (reg.status === 'confirmed') {
      await Player.findOneAndUpdate(
        { rollNumber: cleanedRoll },
        {
          name: cleanedName,
          nicNo: cleanedNic,
          email: cleanedEmail,
          phone: cleanedPhone,
          department,
          $addToSet: { tournamentHistory: reg.tournament._id }
        },
        { upsert: true, new: true }
      );
    }

    await logAdminAction({
      adminId: req.admin._id,
      action: 'UPDATED_REGISTRATION',
      targetId: reg._id,
      targetModel: 'Registration',
      details: { tournament: reg.tournament._id, rollNumber: cleanedRoll, updatedFields },
      req
    });

    res.json(reg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


'''
text = text[:start] + new_block + text[end:]
path.write_text(text, encoding='utf-8')
print('patched update route')
